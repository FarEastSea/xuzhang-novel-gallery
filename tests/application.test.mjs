import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { once } from 'node:events';
import { createApplication } from '../server/application.mjs';
import { versionInfo } from '../version.mjs';
import { DatabaseSync } from 'node:sqlite';
import { defaults, hashPassword } from '../server/store.mjs';

async function fixture(t, options = {}) {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'xuzhang-test-'));
  await options.prepareData?.(dir);
  const upstreamCalls = [];
  const application = createApplication({ dataDir: dir, fetchImpl: async (url, init) => { upstreamCalls.push({ url: String(url), init }); return Response.json({ success: true, data: String(url).includes('/health') ? { status: 'ok' } : String(url).includes('/chapters') ? [{ id: 'c1', title: 'chapter', content: 'text', secret: 'private' }] : String(url).includes('/novels/n1') ? { id: 'n1', title: 'Novel', apiKey: 'private', workspaceSourceRoute: '/lab/private', chapters: [] } : { items: [{ id: 'n1', title: 'Novel', apiKey: 'private', workspaceSourceRoute: '/lab/private' }] } }); }, ...options });
  const server = createServer((req, res) => application.handle(req, res, new URL(req.url, 'http://localhost')).then(handled => { if (!handled) { res.writeHead(404); res.end(); } }));
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  async function call(route, { method = 'GET', body, cookie, headers = {} } = {}) {
    const response = await fetch(base + route, { method, redirect: 'manual', headers: { ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(method !== 'GET' ? { 'X-Requested-With': 'Xuzhang', Origin: base } : {}), ...(cookie ? { Cookie: cookie } : {}), ...headers }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
    let payload; const raw = await response.text(); try { payload = JSON.parse(raw); } catch {}
    return { status: response.status, data: payload?.data, message: payload?.message, cookie: response.headers.get('set-cookie')?.split(';')[0], headers: response.headers, raw };
  }
  async function setup() { const token = (await readFile(path.join(dir, 'setup-token'), 'utf8')).trim(); return call('/api/setup', { method: 'POST', body: { token, username: 'owner', password: 'owner-password-123' } }); }
  t.after(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); application.close(); await rm(dir, { recursive: true, force: true }); });
  return { dir, application, call, setup, upstreamCalls };
}

async function publish(f, owner, id = 'n1', changes = {}) {
  const catalog = await f.call('/api/admin/catalog', { cookie: owner.cookie });
  assert.equal(catalog.status, 200);
  const work = catalog.data.items.find(item => item.id === id);
  assert.ok(work, 'Novel is in the administrator catalog');
  return f.call('/api/admin/publications/' + id, { method: 'PUT', cookie: owner.cookie, body: { sourceKey: catalog.data.sourceKey, published: true, visibility: 'public', userIds: [], revision: work.revision, ...changes } });
}
test('bootstrap requires secret; only first admin can claim it; session survives store reopen', async t => {
  const f = await fixture(t);
  assert.equal((await f.call('/api/session')).data.needsSetup, true);
  assert.equal((await f.call('/api/setup', { method: 'POST', body: { token: 'bad', username: 'owner', password: 'owner-password-123' } })).status, 403);
  const owner = await f.setup(); assert.equal(owner.status, 201);
  assert.match(owner.headers.get('set-cookie'), /HttpOnly; SameSite=Lax/);
  assert.equal((await f.call('/api/setup', { method: 'POST', body: {} })).status, 409);
  await assert.rejects(readFile(path.join(f.dir, 'setup-token')));
  assert.equal((await f.call('/api/session', { cookie: owner.cookie })).data.user.role, 'admin');
  const stored = f.application.store.db.prepare('SELECT * FROM users').get(); assert.notEqual(stored.password, 'owner-password-123');
  const second = createApplication({ dataDir: f.dir });
  assert.equal(second.store.initialized(), true); assert.equal(second.store.settings().sessionHours, 24); second.close();
});
test('concurrent bootstrap requests create exactly one admin', async t => {
  const f = await fixture(t); const results = await Promise.all([f.setup(), f.setup()]);
  assert.deepEqual(results.map(v => v.status).sort(), [201, 409]);
  assert.equal(f.application.store.db.prepare('SELECT count(*) AS n FROM users').get().n, 1);
});
test('guest cannot access administration, studio or any upstream write operation', async t => {
  const f = await fixture(t); await f.setup();
  for (const route of ['/api/admin/users', '/api/admin/settings', '/api/studio']) assert.equal((await f.call(route)).status, 401);
  for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) assert.equal((await f.call('/api/novels/n1', { method, body: {} })).status, 405);
  for (const route of ['/api/tasks', '/api/novels/n1/export', '/api/novels/n1%2Ftasks', '/api', '/api/health/extra']) assert.equal((await f.call(route)).status, 404);
  assert.equal(f.upstreamCalls.length, 0);
  const session = await f.call('/api/session'); assert.equal(session.data.studioEnabled, false); assert.equal(session.data.user, null);
});
test('mutations reject cross-site and missing request proof', async t => {
  const f = await fixture(t); const owner = await f.setup();
  assert.equal((await f.call('/api/admin/settings', { method: 'PUT', cookie: owner.cookie, body: defaults, headers: { Origin: 'https://attacker.invalid' } })).status, 403);
  assert.equal((await f.call('/api/admin/settings', { method: 'PUT', cookie: owner.cookie, body: defaults, headers: { 'X-Requested-With': '' } })).status, 403);
  assert.equal((await f.call('/api/admin/settings', { method: 'PUT', cookie: owner.cookie, body: defaults, headers: { 'Sec-Fetch-Site': 'cross-site' } })).status, 403);
});
test('settings validate complete snapshots and become effective immediately without exposing origin', async t => {
  const f = await fixture(t); const owner = await f.setup();
  const config = { ...defaults, studioOrigin: 'http://studio.internal:28080', studioPublicUrl: 'https://studio.example.test', sessionHours: 2 };
  assert.equal((await f.call('/api/admin/settings', { method: 'PUT', cookie: owner.cookie, body: config })).status, 200);
  assert.equal((await f.call('/api/admin/settings', { cookie: owner.cookie })).data.studioOrigin, config.studioOrigin);
  for (const patch of [{ studioOrigin: 'file:///etc/passwd' }, { studioOrigin: 'http://u:pass@studio' }, { studioOrigin: 'http://studio/path' }, { sessionHours: 0 }, { timeoutSeconds: 31 }]) assert.equal((await f.call('/api/admin/settings', { method: 'PUT', cookie: owner.cookie, body: { ...config, ...patch } })).status, 400);
  assert.equal((await f.call('/api/admin/settings', { method: 'PUT', cookie: owner.cookie, body: { studioOrigin: '' } })).status, 400);
  const guest = await f.call('/api/session'); assert.ok(!guest.raw.includes('studio.internal'));
  const redirect = await f.call('/api/studio?path=/lab/director/book', { cookie: owner.cookie }); assert.equal(redirect.status, 302); assert.equal(redirect.headers.get('location'), 'https://studio.example.test/lab/director/book');
  assert.equal((await f.call('/api/studio?path=//evil.test', { cookie: owner.cookie })).status, 400);
  assert.equal((await f.call('/api/admin/connection', { cookie: owner.cookie, method: 'POST', body: {} })).data.online, true);
});
test('proxy allows only reading projections and never forwards browser credentials or arbitrary query parameters', async t => {
  const f = await fixture(t); const owner = await f.setup();
  await f.call('/api/admin/settings', { method: 'PUT', cookie: owner.cookie, body: { ...defaults, studioOrigin: 'http://studio.internal:28080' } });
  assert.equal((await publish(f, owner)).status, 200);
  const list = await f.call('/api/novels?limit=999&includeSecrets=true', { cookie: owner.cookie, headers: { Authorization: 'Bearer private' } });
  assert.equal(list.status, 200); assert.equal(list.data.items[0].title, 'Novel'); assert.ok(!list.raw.includes('private'));
  assert.equal(f.upstreamCalls.at(-1).url, 'http://studio.internal:28080/api/novels?limit=100');
  assert.deepEqual(f.upstreamCalls.at(-1).init.headers, { Accept: 'application/json' });
  assert.equal((await f.call('/api/novels/n1')).status, 200);
  const chapters = await f.call('/api/novels/n1/chapters'); assert.equal(chapters.data[0].content, 'text'); assert.ok(!chapters.raw.includes('secret'));
});
test('member cannot administer; disable, reset password and deletion revoke sessions', async t => {
  const f = await fixture(t); const owner = await f.setup();
  const created = await f.call('/api/admin/users', { method: 'POST', cookie: owner.cookie, body: { username: 'reader', password: 'reader-password-123', role: 'member' } }); assert.equal(created.status, 201);
  const login = () => f.call('/api/login', { method: 'POST', body: { username: 'READER', password: 'reader-password-123' } });
  let member = await login(); assert.equal(member.status, 200);
  assert.equal((await f.call('/api/admin/users', { cookie: member.cookie })).status, 403);
  assert.equal((await f.call('/api/admin/settings', { cookie: member.cookie, method: 'PUT', body: defaults })).status, 403);
  assert.equal((await f.call(`/api/admin/users/${created.data.id}`, { method: 'PATCH', cookie: owner.cookie, body: { role: 'member', enabled: false } })).status, 200);
  assert.equal((await f.call('/api/session', { cookie: member.cookie })).data.user, null); assert.equal((await login()).status, 401);
  await f.call(`/api/admin/users/${created.data.id}`, { method: 'PATCH', cookie: owner.cookie, body: { role: 'member', enabled: true } }); member = await login();
  await f.call(`/api/admin/users/${created.data.id}`, { method: 'PATCH', cookie: owner.cookie, body: { role: 'member', enabled: true, password: 'changed-password-123' } });
  assert.equal((await f.call('/api/session', { cookie: member.cookie })).data.user, null); assert.equal((await login()).status, 401);
  assert.equal((await f.call(`/api/admin/users/${created.data.id}`, { method: 'DELETE', cookie: owner.cookie })).status, 200);
  const users = await f.call('/api/admin/users', { cookie: owner.cookie }); assert.equal(users.data.length, 1); assert.ok(!users.raw.includes('password'));
});
test('current admin cannot self-delete or self-disable; usernames and passwords are validated', async t => {
  const f = await fixture(t); const owner = await f.setup();
  assert.equal((await f.call(`/api/admin/users/${owner.data.id}`, { method: 'DELETE', cookie: owner.cookie })).status, 400);
  assert.equal((await f.call(`/api/admin/users/${owner.data.id}`, { method: 'PATCH', cookie: owner.cookie, body: { role: 'member', enabled: false } })).status, 400);
  for (const body of [{ username: 'a', password: 'valid-password-123', role: 'member' }, { username: 'valid', password: 'short', role: 'member' }, { username: 'valid', password: 'valid-password-123', role: 'superuser' }]) assert.equal((await f.call('/api/admin/users', { method: 'POST', cookie: owner.cookie, body })).status, 400);
  assert.equal((await f.call('/api/admin/users', { method: 'POST', cookie: owner.cookie, body: { username: 'OWNER', password: 'valid-password-123', role: 'member' } })).status, 409);
});
test('own password update invalidates all sessions and logout invalidates its token', async t => {
  const f = await fixture(t); const owner = await f.setup();
  const other = await f.call('/api/login', { method: 'POST', body: { username: 'owner', password: 'owner-password-123' } });
  assert.equal((await f.call('/api/account/password', { method: 'PUT', cookie: owner.cookie, body: { currentPassword: 'wrong', password: 'next-password-123' } })).status, 400);
  assert.equal((await f.call('/api/account/password', { method: 'PUT', cookie: owner.cookie, body: { currentPassword: 'owner-password-123', password: 'next-password-123' } })).status, 200);
  for (const cookie of [owner.cookie, other.cookie]) assert.equal((await f.call('/api/session', { cookie })).data.user, null);
  const login = await f.call('/api/login', { method: 'POST', body: { username: 'owner', password: 'next-password-123' } }); assert.equal(login.status, 200);
  await f.call('/api/logout', { method: 'POST', cookie: login.cookie, body: {} }); assert.equal((await f.call('/api/session', { cookie: login.cookie })).data.user, null);
});
test('offline snapshot remains runtime data; admin may disable guest access to it', async t => {
  const f = await fixture(t); const owner = await f.setup();
  await writeFile(path.join(f.dir, 'snapshot.json'), JSON.stringify({ source: 'http://private', generatedAt: 'now', works: [{ id: 'n1', title: 'Offline', workspaceSourceRoute: '/private', secret: 'private' }] }));
  assert.deepEqual((await f.call('/api/snapshot')).data.works, []);
  assert.equal((await publish(f, owner)).status, 200);
  const result = await f.call('/api/snapshot'); assert.equal(result.data.works[0].title, 'Offline'); assert.ok(!result.raw.includes('private'));
  await f.call('/api/admin/settings', { method: 'PUT', cookie: owner.cookie, body: { ...defaults, snapshotEnabled: false } });
  assert.deepEqual((await f.call('/api/snapshot')).data.works, []);
});
test('upstream errors and redirects never expose internal addresses', async t => {
  const f = await fixture(t, { fetchImpl: async () => { throw new Error('http://internal/private?key=secret'); } }); const owner = await f.setup();
  await f.call('/api/admin/settings', { method: 'PUT', cookie: owner.cookie, body: { ...defaults, studioOrigin: 'http://internal' } });
  const result = await f.call('/api/novels', { cookie: owner.cookie }); assert.equal(result.status, 502); assert.ok(!result.raw.includes('internal'));
});
test('login attempts are throttled', async t => {
  const f = await fixture(t); await f.setup();
  let result; for (let i = 0; i < 11; i++) result = await f.call('/api/login', { method: 'POST', body: { username: 'owner', password: 'wrong' } });
  assert.equal(result.status, 429);
});
test('proxy HTTPS enables secure cookies only when explicitly trusted', async t => {
  const f = await fixture(t, { trustProxy: true });
  const token = (await readFile(path.join(f.dir, 'setup-token'), 'utf8')).trim();
  const result = await f.call('/api/setup', { method: 'POST', headers: { 'X-Forwarded-Proto': 'https', Origin: '' }, body: { token, username: 'owner', password: 'owner-password-123' } });
  assert.match(result.headers.get('set-cookie'), /; Secure/);
});

test('health endpoint reports the exact aligned application and Studio versions', async t => {
  const f = await fixture(t);
  const health = await f.call('/healthz');
  assert.equal(health.status, 200);
  assert.equal(health.data.version, versionInfo.version);
  assert.equal(health.data.studioVersion, versionInfo.studioVersion);
});
// New stories are hidden until an administrator explicitly publishes them.
test('publication scopes apply equally to lists, details, chapters and offline snapshots', async t => {
  const ids = ['public-book', 'member-book', 'selected-book', 'admin-book', 'draft-book'];
  const novels = ids.map(id => ({ id, title: id, genre: { name: 'Test' }, chapters: [{ id: id + '-chapter', title: id + '-chapter', content: 'CONTENT:' + id }] }));
  const f = await fixture(t, { fetchImpl: async url => {
    const route = new URL(url).pathname;
    if (route === '/api/novels') return Response.json({ success: true, data: { items: novels } });
    const book = novels.find(value => value.id === route.split('/')[3]);
    return book ? Response.json({ success: true, data: route.endsWith('/chapters') ? book.chapters : book }) : Response.json({}, { status: 404 });
  } });
  const owner = await f.setup();
  await f.call('/api/admin/settings', { cookie: owner.cookie, method: 'PUT', body: { ...defaults, studioOrigin: 'http://studio.internal' } });
  await writeFile(path.join(f.dir, 'snapshot.json'), JSON.stringify({ works: novels, generatedAt: 'now' }));
  async function createReader(username) {
    const created = await f.call('/api/admin/users', { cookie: owner.cookie, method: 'POST', body: { username, password: 'reader-password-123', role: 'member' } });
    const login = await f.call('/api/login', { method: 'POST', body: { username, password: 'reader-password-123' } });
    return { ...created.data, cookie: login.cookie };
  }
  const anna = await createReader('anna'); const bob = await createReader('bobby');
  const before = (await f.call('/api/session')).data.accessKey;
  assert.deepEqual((await f.call('/api/novels')).data.items, []);
  assert.deepEqual((await f.call('/api/snapshot', { cookie: anna.cookie })).data.works, []);
  assert.equal((await f.call('/api/admin/catalog')).status, 401);
  assert.equal((await f.call('/api/admin/catalog', { cookie: anna.cookie })).status, 403);
  for (const id of ids) assert.equal((await f.call('/api/novels/' + id)).status, 404);
  assert.equal((await f.call('/api/admin/catalog', { cookie: owner.cookie })).data.items.length, 5);
  assert.equal((await publish(f, owner, 'public-book')).status, 200);
  assert.equal((await publish(f, owner, 'member-book', { visibility: 'members' })).status, 200);
  assert.equal((await publish(f, owner, 'selected-book', { visibility: 'selected', userIds: [anna.id] })).status, 200);
  assert.equal((await publish(f, owner, 'admin-book', { visibility: 'admins' })).status, 200);
  assert.notEqual((await f.call('/api/session')).data.accessKey, before);
  for (const [reader, expected] of [[null, ['public-book']], [anna, ['public-book', 'member-book', 'selected-book']], [bob, ['public-book', 'member-book']], [owner, ids]]) {
    const cookie = reader?.cookie;
    const list = await f.call('/api/novels', { cookie });
    assert.deepEqual(list.data.items.map(value => value.id).sort(), [...expected].sort());
    assert.deepEqual((await f.call('/api/snapshot', { cookie })).data.works.map(value => value.id).sort(), [...expected].sort());
    for (const id of ids) for (const suffix of ['', '/chapters']) {
      const result = await f.call('/api/novels/' + id + suffix, { cookie });
      assert.equal(result.status, expected.includes(id) ? 200 : 404, `${reader?.id || 'guest'} / ${id}${suffix}`);
      if (!expected.includes(id)) assert.ok(!result.raw.includes('CONTENT:' + id));
    }
  }
  novels.push({ id: 'new-book', title: 'new-book', chapters: [] });
  assert.ok(!(await f.call('/api/novels', { cookie: anna.cookie })).raw.includes('new-book'));
  assert.equal((await f.call('/api/novels/new-book/chapters', { cookie: anna.cookie })).status, 404);
  await publish(f, owner, 'selected-book', { visibility: 'selected', userIds: [bob.id] });
  assert.equal((await f.call('/api/novels/selected-book', { cookie: anna.cookie })).status, 404);
  assert.equal((await f.call('/api/novels/selected-book', { cookie: bob.cookie })).status, 200);
  await publish(f, owner, 'public-book', { published: false });
  assert.equal((await f.call('/api/novels/public-book/chapters', { cookie: bob.cookie })).status, 404);
  assert.ok(!(await f.call('/api/snapshot')).raw.includes('public-book'));
});

test('publication changes are validated, atomic, optimistic and scoped to the configured source', async t => {
  const f = await fixture(t); const owner = await f.setup();
  const config = { ...defaults, studioOrigin: 'http://first.internal' };
  await f.call('/api/admin/settings', { method: 'PUT', cookie: owner.cookie, body: config });
  let catalog = (await f.call('/api/admin/catalog', { cookie: owner.cookie })).data;
  const body = { sourceKey: catalog.sourceKey, published: true, visibility: 'public', revision: 0, userIds: [] };
  assert.equal((await f.call('/api/admin/publications/n1', { method: 'PUT', body })).status, 401);
  for (const change of [{ visibility: 'unknown' }, { userIds: ['missing'] }, { visibility: 'selected', userIds: [] }, { visibility: 'selected', userIds: ['missing'] }, { revision: -1 }]) assert.equal((await f.call('/api/admin/publications/n1', { cookie: owner.cookie, method: 'PUT', body: { ...body, ...change } })).status, 400);
  const results = await Promise.all([1, 2].map(() => f.call('/api/admin/publications/n1', { cookie: owner.cookie, method: 'PUT', body })));
  assert.deepEqual(results.map(value => value.status).sort(), [200, 409]);
  assert.equal((await f.call('/api/novels/n1')).status, 200);
  await f.call('/api/admin/settings', { method: 'PUT', cookie: owner.cookie, body: { ...config, studioOrigin: 'http://second.internal' } });
  assert.deepEqual((await f.call('/api/novels')).data.items, []);
  assert.equal((await f.call('/api/novels/n1')).status, 404);
  assert.equal((await f.call('/api/admin/publications/n1', { cookie: owner.cookie, method: 'PUT', body: { ...body, revision: 1 } })).status, 409);
  await f.call('/api/admin/settings', { method: 'PUT', cookie: owner.cookie, body: config });
  assert.equal((await f.call('/api/novels/n1')).status, 200);
});

test('permissions are checked again after an in-flight upstream read', async t => {
 for (const upstreamFailure of [false, true]) {
  let waiting; let release;
  const started = new Promise(resolve => { waiting = resolve; });
  const blocked = new Promise(resolve => { release = resolve; });
  const f = await fixture(t, { fetchImpl: async url => {
    if (String(url).endsWith('/chapters')) { waiting(); await blocked; if (upstreamFailure) throw new Error('source went offline'); return Response.json({ data: [{ id: 'c1', content: 'PRIVATE-PENDING-CONTENT' }] }); }
    return Response.json({ data: { items: [{ id: 'n1', title: 'Novel' }] } });
  } });
  const owner = await f.setup();
  await f.call('/api/admin/settings', { method: 'PUT', cookie: owner.cookie, body: { ...defaults, studioOrigin: 'http://studio.internal' } });
  await publish(f, owner);
  const pending = f.call('/api/novels/n1/chapters'); await started;
  await publish(f, owner, 'n1', { published: false }); release();
  const result = await pending; assert.equal(result.status, 404); assert.ok(!result.raw.includes('PRIVATE-PENDING-CONTENT'));
 }
});

test('administrators can withdraw works even when their live source is unavailable', async t => {
  let offline = false;
  const f = await fixture(t, { fetchImpl: async () => { if (offline) throw new Error('down'); return Response.json({ data: { items: [{ id: 'n1', title: 'Persisted title', genre: { name: 'Genre' } }] } }); } });
  const owner = await f.setup();
  await f.call('/api/admin/settings', { method: 'PUT', cookie: owner.cookie, body: { ...defaults, studioOrigin: 'http://studio.internal' } });
  await publish(f, owner); offline = true;
  const catalog = await f.call('/api/admin/catalog', { cookie: owner.cookie });
  assert.equal(catalog.data.items[0].title, 'Persisted title'); assert.equal(catalog.data.items[0].source, 'unavailable');
  assert.equal((await publish(f, owner, 'n1', { published: false })).status, 200);
  assert.equal((await f.call('/api/novels/n1')).status, 404);
});

test('member Studio entry requires an explicit independent grant', async t => {
  const f = await fixture(t); const owner = await f.setup();
  await f.call('/api/admin/settings', { method: 'PUT', cookie: owner.cookie, body: { ...defaults, studioPublicUrl: 'https://studio.example.test' } });
  const created = await f.call('/api/admin/users', { cookie: owner.cookie, method: 'POST', body: { username: 'reader', password: 'reader-password-123', role: 'member' } });
  const login = () => f.call('/api/login', { method: 'POST', body: { username: 'reader', password: 'reader-password-123' } });
  let reader = await login();
  assert.equal((await f.call('/api/session', { cookie: reader.cookie })).data.studioEnabled, false);
  assert.equal((await f.call('/api/studio', { cookie: reader.cookie })).status, 403);
  await f.call('/api/admin/users/' + created.data.id, { cookie: owner.cookie, method: 'PATCH', body: { role: 'member', enabled: true, studioAccess: true } });
  reader = await login(); assert.equal((await f.call('/api/session', { cookie: reader.cookie })).data.studioEnabled, true);
  assert.equal((await f.call('/api/studio', { cookie: reader.cookie })).status, 302);
  await f.call('/api/admin/users/' + created.data.id, { cookie: owner.cookie, method: 'PATCH', body: { role: 'member', enabled: true, studioAccess: false } });
  assert.equal((await f.call('/api/studio', { cookie: reader.cookie })).status, 401);
  reader = await login(); assert.equal((await f.call('/api/studio', { cookie: reader.cookie })).status, 403);
});

test('administrator catalog reads every upstream page before applying publication rules', async t => {
  const f = await fixture(t, { fetchImpl: async url => { const page = new URL(url).searchParams.get('page') || '1'; return Response.json({ data: { items: [{ id: 'n' + page, title: 'Book ' + page }], totalPages: 2 } }); } });
  const owner = await f.setup();
  await f.call('/api/admin/settings', { cookie: owner.cookie, method: 'PUT', body: { ...defaults, studioOrigin: 'http://studio.internal' } });
  const catalog = await f.call('/api/admin/catalog', { cookie: owner.cookie });
  assert.deepEqual(catalog.data.items.map(value => value.id), ['n1', 'n2']);
  await publish(f, owner, 'n2');
  assert.deepEqual((await f.call('/api/novels')).data.items.map(value => value.id), ['n2']);
});

test('legacy accounts migrate without auto-publishing or inheriting Studio entry', async t => {
  const f = await fixture(t, { prepareData: async dir => {
    const old = new DatabaseSync(path.join(dir, 'xuzhang.sqlite'));
    old.exec(`CREATE TABLE users (id TEXT PRIMARY KEY, username TEXT UNIQUE NOT NULL, password TEXT NOT NULL, role TEXT NOT NULL, enabled INTEGER NOT NULL, created_at TEXT NOT NULL)`);
    const password = await hashPassword('legacy-password-123');
    const add = old.prepare('INSERT INTO users VALUES (?, ?, ?, ?, 1, ?)');
    add.run('old-admin', 'old_admin', password, 'admin', new Date().toISOString());
    add.run('old-reader', 'old_reader', password, 'member', new Date().toISOString());
    old.close();
  } });
  const owner = await f.call('/api/login', { method: 'POST', body: { username: 'old_admin', password: 'legacy-password-123' } });
  assert.equal(owner.status, 200);
  await f.call('/api/admin/settings', { cookie: owner.cookie, method: 'PUT', body: { ...defaults, studioOrigin: 'http://studio.internal', studioPublicUrl: 'https://studio.example.test' } });
  const reader = await f.call('/api/login', { method: 'POST', body: { username: 'old_reader', password: 'legacy-password-123' } });
  assert.equal(reader.status, 200);
  assert.equal((await f.call('/api/session', { cookie: reader.cookie })).data.studioEnabled, false);
  assert.deepEqual((await f.call('/api/novels', { cookie: reader.cookie })).data.items, []);
  assert.equal((await f.call('/api/admin/catalog', { cookie: owner.cookie })).data.items[0].published, false);
});
