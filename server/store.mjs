import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { randomBytes, createHash, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import path from 'node:path';
const scrypt = promisify(scryptCallback);
export const digest = (value) => createHash('sha256').update(value).digest('hex');
export const publicUser = (user) => user ? { id: user.id, username: user.username, role: user.role, enabled: Boolean(user.enabled), createdAt: user.created_at } : null;
export const defaults = Object.freeze({ studioOrigin: '', studioPublicUrl: '', snapshotEnabled: true, sessionHours: 24, timeoutSeconds: 10 });
export async function hashPassword(password) {
  if (typeof password !== 'string' || password.length < 12 || password.length > 128) throw Object.assign(new Error('密码须为 12–128 个字符'), { status: 400 });
  const salt = randomBytes(16).toString('hex');
  return `${salt}:${Buffer.from(await scrypt(password, salt, 64)).toString('hex')}`;
}
export async function verifyPassword(password, encoded) {
  if (typeof password !== 'string' || password.length > 128) return false;
  const [salt, hash] = encoded.split(':');
  const actual = Buffer.from(await scrypt(password, salt, 64));
  return timingSafeEqual(actual, Buffer.from(hash, 'hex'));
}
export function validateUsername(value) {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9_\-]{3,32}$/.test(value)) throw Object.assign(new Error('用户名须为 3–32 位字母、数字、下划线或短横线'), { status: 400 });
  return value.toLowerCase();
}
export function validateSettings(value) {
  if (!value || typeof value !== 'object') throw Object.assign(new Error('配置格式错误'), { status: 400 });
  const result = {};
  for (const key of ['studioOrigin', 'studioPublicUrl']) {
    const input = value[key];
    if (typeof input !== 'string' || input.length > 2048) throw Object.assign(new Error('请填写有效地址，或留空以断开联动'), { status: 400 });
    if (!input.trim()) { result[key] = ''; continue; }
    let url;
    try { url = new URL(input.trim()); } catch { throw Object.assign(new Error('地址须为完整的 HTTP / HTTPS 地址'), { status: 400 }); }
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash || (key === 'studioOrigin' && url.pathname !== '/')) throw Object.assign(new Error('服务地址须为 HTTP / HTTPS 源地址，不能含凭据、查询或片段'), { status: 400 });
    result[key] = url.href.replace(/\/+$/, '');
  }
  if (typeof value.snapshotEnabled !== 'boolean' || !Number.isInteger(value.sessionHours) || value.sessionHours < 1 || value.sessionHours > 168 || !Number.isInteger(value.timeoutSeconds) || value.timeoutSeconds < 2 || value.timeoutSeconds > 30) throw Object.assign(new Error('会话时长须为 1–168 小时，连接超时须为 2–30 秒'), { status: 400 });
  return { ...result, snapshotEnabled: value.snapshotEnabled, sessionHours: value.sessionHours, timeoutSeconds: value.timeoutSeconds };
}
export function openStore(dataDir) {
  mkdirSync(dataDir, { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(path.join(dataDir, 'xuzhang.sqlite'));
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, username TEXT NOT NULL UNIQUE, password TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('admin','member')), enabled INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS sessions (hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS settings (id INTEGER PRIMARY KEY CHECK(id=1), value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);`);
  db.prepare('INSERT OR IGNORE INTO settings VALUES (1, ?)').run(JSON.stringify(defaults));
  const tokenPath = path.join(dataDir, 'setup-token');
  const initialized = () => Boolean(db.prepare('SELECT 1 FROM users LIMIT 1').get());
  if (!initialized()) {
    let token;
    try { token = readFileSync(tokenPath, 'utf8').trim(); } catch { token = randomBytes(24).toString('hex'); writeFileSync(tokenPath, token, { mode: 0o600 }); }
    db.prepare("INSERT OR REPLACE INTO meta VALUES ('setupHash', ?)").run(digest(token));
  } else { rmSync(tokenPath, { force: true }); }
  return {
    db, initialized, tokenPath,
    settings: () => JSON.parse(db.prepare('SELECT value FROM settings WHERE id=1').get().value),
    transaction(fn) { db.exec('BEGIN IMMEDIATE'); try { const value = fn(); db.exec('COMMIT'); return value; } catch (error) { db.exec('ROLLBACK'); throw error; } },
    completeSetup() { db.prepare("DELETE FROM meta WHERE key='setupHash'").run(); rmSync(tokenPath, { force: true }); },
    close: () => db.close(),
  };
}
