// Diagnose the same repository-scoped token used by the release workflow.
// No token is printed, persisted or included in a request URL.
const image = process.env.GITHUB_REPOSITORY?.toLowerCase();
const user = process.env.GITHUB_ACTOR;
const password = process.env.GITHUB_TOKEN;
if (!image || !user || !password) throw new Error('Run this diagnostic from the repository GitHub Actions workflow');
const base = 'https://ghcr.io';
const headers = { Authorization: 'Basic ' + Buffer.from(user + ':' + password).toString('base64') };
const authUrl = new URL('/token', base);
authUrl.searchParams.set('service', 'ghcr.io');
authUrl.searchParams.set('scope', `repository:${image}:pull,push`);
const auth = await fetch(authUrl, { headers, redirect: 'error', signal: AbortSignal.timeout(30_000) });
console.log(JSON.stringify({ step: 'registry-token', status: auth.status, image }));
if (!auth.ok) { process.exitCode = 1; }
else {
  const payload = await auth.json();
  const token = payload.token || payload.access_token;
  if (!token) throw new Error('Registry did not issue a token');
  const registryHeaders = { Authorization: 'Bearer ' + token, Accept: 'application/vnd.oci.image.index.v1+json, application/vnd.oci.image.manifest.v1+json, application/vnd.docker.distribution.manifest.list.v2+json, application/vnd.docker.distribution.manifest.v2+json' };
  async function request(route, method = 'GET') {
    return fetch(new URL(route, base), { method, headers: registryHeaders, redirect: 'error', signal: AbortSignal.timeout(30_000) });
  }
  async function errors(response) {
    try { return (await response.json()).errors?.map(value => ({ code: value.code, message: String(value.message).slice(0, 180) })); } catch { return []; }
  }
  const previous = await request(`/v2/${image}/manifests/0.7.1`);
  console.log(JSON.stringify({ step: 'read-previous-version', status: previous.status, errors: previous.ok ? [] : await errors(previous) }));
  if (previous.ok) {
    let manifest = await previous.json();
    const platform = manifest.manifests?.find(item => item.platform?.architecture === 'amd64' && item.platform?.os === 'linux');
    if (platform) { const child = await request(`/v2/${image}/manifests/${platform.digest}`); if (child.ok) manifest = await child.json(); }
    if (manifest.layers?.[0]?.digest) {
      const known = await request(`/v2/${image}/blobs/${manifest.layers[0].digest}`, 'HEAD');
      console.log(JSON.stringify({ step: 'head-existing-layer', status: known.status }));
    }
  }
  const missing = await request(`/v2/${image}/blobs/sha256:${'0'.repeat(64)}`, 'HEAD');
  console.log(JSON.stringify({ step: 'head-missing-layer', status: missing.status }));
  const upload = await request(`/v2/${image}/blobs/uploads/`, 'POST');
  console.log(JSON.stringify({ step: 'start-empty-upload', status: upload.status, errors: upload.ok ? [] : await errors(upload) }));
  if (upload.status === 202) {
    const location = upload.headers.get('location');
    if (!location) throw new Error('Registry did not return an upload location');
    const target = new URL(location, base);
    if (target.origin !== base || !target.pathname.startsWith(`/v2/${image}/blobs/uploads/`)) throw new Error('Refusing unexpected upload cancellation URL');
    const cancelled = await request(target.href, 'DELETE');
    console.log(JSON.stringify({ step: 'cancel-empty-upload', status: cancelled.status }));
    if (!cancelled.ok) process.exitCode = 1;
  } else process.exitCode = 1;
  if (previous.status !== 200) process.exitCode = 1;
}
