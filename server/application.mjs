import { randomBytes, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { openStore, digest, publicUser, hashPassword, verifyPassword, validateUsername, validateSettings } from './store.mjs';
import { projectReadingData, projectSnapshot } from './library.mjs';
const fail = (status, message) => { throw Object.assign(new Error(message), { status }); };
const SESSION = 'xuzhang_session';
async function readJson(req) {
  if (!req.headers['content-type']?.startsWith('application/json')) fail(415, '请使用 JSON 请求');
  let size = 0; const chunks = [];
  for await (const chunk of req) { size += chunk.length; if (size > 16_384) fail(413, '请求内容过大'); chunks.push(chunk); }
  try { const value = JSON.parse(Buffer.concat(chunks).toString()); if (!value || Array.isArray(value) || typeof value !== 'object') fail(400, '请求格式错误'); return value; }
  catch { fail(400, '请求格式错误'); }
}
export function createApplication({ dataDir, trustProxy = false, fetchImpl = fetch }) {
  const store = openStore(dataDir);
  const { db } = store;
  const rates = new Map();
  const dummyPassword = hashPassword(randomBytes(24).toString('hex'));
  function throttle(key) {
    const now = Date.now();
    for (const [k, v] of rates) if (v.until < now) rates.delete(k);
    if (!rates.has(key) && rates.size >= 10_000) fail(429, '请求过多，请稍后重试');
    const item = rates.get(key) || { count: 0, until: now + 15 * 60_000 };
    rates.set(key, item); item.count++;
    if (item.count > 10) fail(429, '尝试过多，请在 15 分钟后重试');
  }
  function session(req) {
    const raw = req.headers.cookie?.split(';').map(v => v.trim()).find(v => v.startsWith(`${SESSION}=`))?.slice(SESSION.length + 1);
    if (!raw || !/^[a-f0-9]{64}$/.test(raw)) return null;
    return db.prepare('SELECT u.*, s.hash AS session_hash FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.hash=? AND s.expires>? AND u.enabled=1').get(digest(raw), Date.now()) || null;
  }
  function setSession(req, res, user) {
    const raw = randomBytes(32).toString('hex');
    const ttl = store.settings().sessionHours * 3600;
    db.prepare('DELETE FROM sessions WHERE expires<=?').run(Date.now());
    db.prepare('INSERT INTO sessions VALUES (?, ?, ?)').run(digest(raw), user.id, Date.now() + ttl * 1000);
    res.setHeader('Set-Cookie', `${SESSION}=${raw}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${ttl}${isSecure(req) ? '; Secure' : ''}`);
  }
  function isSecure(req) { return Boolean(req.socket.encrypted) || (trustProxy && req.headers['x-forwarded-proto'] === 'https'); }
  function writeGuard(req) {
    if (req.headers['x-requested-with'] !== 'Xuzhang') fail(403, '请求校验失败，请刷新后重试');
    if (req.headers['sec-fetch-site'] === 'cross-site') fail(403, '不允许跨站请求');
    if (req.headers.origin) {
      let origin;
      try { origin = new URL(req.headers.origin); } catch { fail(403, '来源校验失败'); }
      if (origin.host !== req.headers.host || origin.protocol !== (isSecure(req) ? 'https:' : 'http:')) fail(403, '来源校验失败');
    }
  }
  function member(user) { if (!user) fail(401, '请先登录'); }
  function recheck(req, role) { const fresh = session(req); member(fresh); if (role === 'admin') admin(fresh); return fresh; }
  function admin(user) { member(user); if (user.role !== 'admin') fail(403, '仅管理员可执行此操作'); }
  const send = (res, data, status = 200) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify({ success: true, data })); };
  async function reading(req, res, url) {
    if (req.method !== 'GET') fail(405, '作品馆接口仅允许读取');
    const allowed = /^\/api\/(?:health|novels(?:\/[A-Za-z0-9_-]+(?:\/chapters)?)?)$/;
    if (!allowed.test(url.pathname)) fail(404, '接口不存在');
    const settings = store.settings();
    if (!settings.studioOrigin) fail(503, '尚未配置作品来源');
    const target = new URL(url.pathname, settings.studioOrigin);
    if (url.pathname === '/api/novels') target.searchParams.set('limit', '100');
    let response;
    try { response = await fetchImpl(target, { headers: { Accept: 'application/json' }, redirect: 'error', signal: AbortSignal.timeout(settings.timeoutSeconds * 1000) }); }
    catch { fail(502, '作品来源暂不可用'); }
    if (!response.ok) fail(response.status === 404 ? 404 : 502, response.status === 404 ? '作品不存在' : '作品来源暂不可用');
    let payload;
    try { payload = await response.json(); } catch { fail(502, '作品来源返回格式错误'); }
    if (payload.success === false) fail(502, '作品来源暂不可用');
    if (url.pathname === '/api/health') { send(res, { status: payload.data?.status === 'ok' ? 'ok' : 'unavailable' }); return; }
    send(res, projectReadingData(payload.data, url.pathname));
  }
  async function handle(req, res, url) {
    if (url.pathname === '/healthz') { send(res, { status: 'ok', initialized: store.initialized() }); return true; }
    if (!url.pathname.startsWith('/api/') && url.pathname !== '/api') return false;
    try {
      const user = session(req);
      const method = req.method;
      if (!['GET', 'HEAD'].includes(method)) writeGuard(req);
      if (url.pathname === '/api/session' && method === 'GET') {
        send(res, { user: publicUser(user), needsSetup: !store.initialized(), studioEnabled: Boolean(user && store.settings().studioPublicUrl) });
      } else if (url.pathname === '/api/setup' && method === 'POST') {
        if (store.initialized()) fail(409, '系统已初始化');
        throttle('setup');
        const body = await readJson(req);
        const expected = db.prepare("SELECT value FROM meta WHERE key='setupHash'").get()?.value;
        if (typeof body.token !== 'string' || digest(body.token) !== expected) fail(403, '初始化密钥无效');
        const username = validateUsername(body.username);
        const password = await hashPassword(body.password);
        const id = randomUUID();
        store.transaction(() => {
          if (store.initialized()) fail(409, '系统已初始化');
          db.prepare('INSERT INTO users VALUES (?, ?, ?, ?, 1, ?)').run(id, username, password, 'admin', new Date().toISOString());
          db.prepare("DELETE FROM meta WHERE key='setupHash'").run();
        });
        store.completeSetup();
        const created = db.prepare('SELECT * FROM users WHERE id=?').get(id);
        setSession(req, res, created); send(res, publicUser(created), 201);
      } else if (url.pathname === '/api/login' && method === 'POST') {
        const body = await readJson(req);
        const username = typeof body.username === 'string' ? body.username.toLowerCase().slice(0, 128) : '';
        const ip = trustProxy ? (String(req.headers['x-forwarded-for'] || req.socket.remoteAddress).split(',').at(-1).trim()) : req.socket.remoteAddress;
        throttle(`ip:${ip}`); throttle(`user:${username}`);
        const found = db.prepare('SELECT * FROM users WHERE username=?').get(username);
        const valid = await verifyPassword(body.password, found?.password || await dummyPassword);
        const fresh = found && db.prepare('SELECT * FROM users WHERE id=?').get(found.id);
        if (!valid || !fresh?.enabled || fresh.password !== found.password) fail(401, '用户名或密码错误，或账户已停用');
        if (user) db.prepare('DELETE FROM sessions WHERE hash=?').run(user.session_hash);
        setSession(req, res, found); rates.delete(`user:${username}`); send(res, publicUser(found));
      } else if (url.pathname === '/api/logout' && method === 'POST') {
        if (user) db.prepare('DELETE FROM sessions WHERE hash=?').run(user.session_hash);
        res.setHeader('Set-Cookie', `${SESSION}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${isSecure(req) ? '; Secure' : ''}`); send(res, null);
      } else if (url.pathname === '/api/account/password' && method === 'PUT') {
        member(user); const body = await readJson(req);
        throttle(`password:${user.id}`);
        if (!await verifyPassword(body.currentPassword, user.password)) fail(400, '当前密码不正确');
        const password = await hashPassword(body.password);
        store.transaction(() => { recheck(req); const fresh = db.prepare('SELECT password FROM users WHERE id=?').get(user.id); if (fresh.password !== user.password) fail(409, '账户已发生变化，请重新登录'); db.prepare('UPDATE users SET password=? WHERE id=?').run(password, user.id); db.prepare('DELETE FROM sessions WHERE user_id=?').run(user.id); });
        send(res, null);
      } else if (url.pathname.startsWith('/api/admin/')) {
        admin(user);
        if (url.pathname === '/api/admin/settings' && method === 'GET') send(res, store.settings());
        else if (url.pathname === '/api/admin/settings' && method === 'PUT') {
          const value = validateSettings(await readJson(req));
          store.transaction(() => { recheck(req, 'admin'); db.prepare('UPDATE settings SET value=? WHERE id=1').run(JSON.stringify(value)); db.prepare('UPDATE sessions SET expires=MIN(expires, ?)').run(Date.now() + value.sessionHours * 3600_000); });
          send(res, value);
        } else if (url.pathname === '/api/admin/connection' && method === 'POST') {
          const settings = store.settings(); if (!settings.studioOrigin) fail(400, '请先保存作品来源地址');
          let online = false;
          try { const response = await fetchImpl(`${settings.studioOrigin}/api/health`, { redirect: 'error', signal: AbortSignal.timeout(settings.timeoutSeconds * 1000) }); const result = await response.json(); online = response.ok && result.success !== false && result.data?.status === 'ok'; } catch {}
          send(res, { online });
        } else if (url.pathname === '/api/admin/users' && method === 'GET') send(res, db.prepare('SELECT * FROM users ORDER BY created_at').all().map(publicUser));
        else if (url.pathname === '/api/admin/users' && method === 'POST') {
          const body = await readJson(req); const username = validateUsername(body.username);
          if (!['admin', 'member'].includes(body.role)) fail(400, '角色无效');
          const password = await hashPassword(body.password);
          if (db.prepare('SELECT 1 FROM users WHERE username=?').get(username)) fail(409, '用户名已存在');
          const id = randomUUID(); recheck(req, 'admin'); db.prepare('INSERT INTO users VALUES (?, ?, ?, ?, 1, ?)').run(id, username, password, body.role, new Date().toISOString());
          send(res, publicUser(db.prepare('SELECT * FROM users WHERE id=?').get(id)), 201);
        } else if (/^\/api\/admin\/users\/[a-f0-9-]+$/.test(url.pathname) && ['PATCH', 'DELETE'].includes(method)) {
          const id = url.pathname.split('/').at(-1); const target = db.prepare('SELECT * FROM users WHERE id=?').get(id);
          if (!target) fail(404, '用户不存在');
          if (target.id === user.id) fail(400, '请使用账户设置修改自己的密码，不能停用或删除当前账户');
          const body = method === 'DELETE' ? {} : await readJson(req);
          if (method === 'PATCH' && (!['admin', 'member'].includes(body.role) || typeof body.enabled !== 'boolean')) fail(400, '角色或账户状态无效');
          const password = body.password ? await hashPassword(body.password) : null;
          store.transaction(() => {
            recheck(req, 'admin');
            const current = db.prepare('SELECT * FROM users WHERE id=?').get(id);
            if (!current) fail(404, '用户不存在');
            if (current.role === 'admin' && current.enabled && (method === 'DELETE' || body.role !== 'admin' || !body.enabled) && db.prepare("SELECT COUNT(*) AS n FROM users WHERE role='admin' AND enabled=1").get().n <= 1) fail(400, '至少保留一个启用的管理员');
            if (method === 'DELETE') db.prepare('DELETE FROM users WHERE id=?').run(id);
            else { db.prepare('UPDATE users SET role=?, enabled=?, password=? WHERE id=?').run(body.role, Number(body.enabled), password || current.password, id); db.prepare('DELETE FROM sessions WHERE user_id=?').run(id); }
          }); send(res, null);
        } else fail(404, '接口不存在');
      } else if (url.pathname === '/api/studio' && method === 'GET') {
        member(user); const target = store.settings().studioPublicUrl; if (!target) fail(404, '创作台入口尚未配置');
        // The redirect itself is authenticated. Never disclose the destination to guests.
        let route = url.searchParams.get('path') || '';
        const novelId = url.searchParams.get('novel');
        if (novelId) {
          if (!/^[A-Za-z0-9_-]+$/.test(novelId)) fail(400, '作品标识无效');
          const settings = store.settings();
          let workspace;
          if (settings.studioOrigin) {
            try { const response = await fetchImpl(settings.studioOrigin + '/api/novels/' + novelId, { headers: { Accept: 'application/json' }, redirect: 'error', signal: AbortSignal.timeout(settings.timeoutSeconds * 1000) }); if (response.ok) workspace = (await response.json()).data?.workspaceSourceRoute; } catch {}
          }
          if (!workspace && settings.snapshotEnabled) {
            try { workspace = JSON.parse(await readFile(path.join(dataDir, 'snapshot.json'), 'utf8')).works?.find(v => v.id === novelId)?.workspaceSourceRoute; } catch {}
          }
          route = typeof workspace === 'string' ? workspace : '/novels/' + novelId;
          recheck(req);
        }
        if (route && (!/^\/(?!\/)[A-Za-z0-9/_-]*$/.test(route))) fail(400, '创作台路径无效');
        const destination = route ? target + route : target;
        res.writeHead(302, { Location: destination, 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' }); res.end();
      } else if (url.pathname === '/api/snapshot' && method === 'GET') {
        let value = { generatedAt: '', source: 'snapshot', works: [] };
        if (store.settings().snapshotEnabled) {
          try { value = projectSnapshot(JSON.parse(await readFile(path.join(dataDir, 'snapshot.json'), 'utf8'))); }
          catch (error) { if (error.code !== 'ENOENT') fail(503, '离线快照不可用'); }
        }
        send(res, value);
      } else await reading(req, res, url);
    } catch (error) {
      if (!res.headersSent) { res.writeHead(error.status || 500, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify({ success: false, data: null, message: error.status ? error.message : '服务暂不可用，请稍后重试' })); }
      else res.end();
    }
    return true;
  }
  return { handle, store, close: () => store.close() };
}
