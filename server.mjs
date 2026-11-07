import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApplication } from './server/application.mjs';
const root = path.dirname(fileURLToPath(import.meta.url));
const application = createApplication({ dataDir: path.resolve(process.env.DATA_DIR || path.join(root, 'data')), trustProxy: process.env.TRUST_PROXY === '1' });
const distDir = path.join(root, 'dist');
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.ico': 'image/x-icon', '.woff2': 'font/woff2' };
const server = createServer(async (req, res) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'same-origin');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
  try {
    const url = new URL(req.url || '/', 'http://localhost');
    if (await application.handle(req, res, url)) return;
    if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405); res.end(); return; }
    const decoded = decodeURIComponent(url.pathname);
    const requested = path.resolve(distDir, `.${decoded}`);
    if (!requested.startsWith(distDir + path.sep) && requested !== distDir) { res.writeHead(403); res.end(); return; }
    let file = requested;
    try { if ((await stat(file)).isDirectory()) file = path.join(file, 'index.html'); }
    catch { if (path.extname(decoded)) { res.writeHead(404); res.end(); return; } file = path.join(distDir, 'index.html'); }
    const info = await stat(file);
    res.setHeader('Content-Type', mime[path.extname(file)] || 'application/octet-stream');
    res.setHeader('Content-Length', info.size);
    res.setHeader('Cache-Control', file.includes(`${path.sep}assets${path.sep}`) ? 'public, max-age=31536000, immutable' : 'no-cache');
    if (req.method === 'HEAD') res.end(); else createReadStream(file).on('error', () => res.destroy()).pipe(res);
  } catch { if (!res.headersSent) res.writeHead(404); res.end(); }
});
server.requestTimeout = 30_000;
server.listen(Number(process.env.PORT || 4173), process.env.HOST || '0.0.0.0', () => {
  console.log(`叙章：http://localhost:${server.address().port}`);
  if (!application.store.initialized()) console.log(`首次初始化：打开 /login，初始化密钥位于 ${application.store.tokenPath}`);
});
for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => { server.close(() => { application.close(); process.exit(0); }); server.closeIdleConnections(); });
