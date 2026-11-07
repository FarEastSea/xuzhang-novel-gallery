import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { once } from 'node:events';
import { createApplication } from '../server/application.mjs';
import { versionInfo } from '../version.mjs';
import { defaults } from '../server/store.mjs';

async function fixture(t, options = {}) {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'xuzhang-test-'));
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
  const result = await f.call('/api/snapshot'); assert.equal(result.data.works[0].title, 'Offline'); assert.ok(!result.raw.includes('private'));
  await f.call('/api/admin/settings', { method: 'PUT', cookie: owner.cookie, body: { ...defaults, snapshotEnabled: false } });
  assert.deepEqual((await f.call('/api/snapshot')).data.works, []);
});
test('upstream errors and redirects never expose internal addresses', async t => {
  const f = await fixture(t, { fetchImpl: async () => { throw new Error('http://internal/private?key=secret'); } }); const owner = await f.setup();
  await f.call('/api/admin/settings', { method: 'PUT', cookie: owner.cookie, body: { ...defaults, studioOrigin: 'http://internal' } });
  const result = await f.call('/api/novels'); assert.equal(result.status, 502); assert.ok(!result.raw.includes('internal'));
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
