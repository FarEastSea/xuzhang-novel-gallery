import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
const root = process.cwd();
const snapshot = JSON.parse(await readFile(path.join(root, 'src/data/snapshot.json'), 'utf8'));
assert.equal(snapshot.works.length, 0, 'Source snapshot must not contain private works');
const ignore = await readFile('.gitignore', 'utf8');
for (const rule of ['/data/', '.env', 'node_modules/', 'dist/']) assert.ok(ignore.split(/\r?\n/).includes(rule), `Missing ignore rule: ${rule}`);
let ignoredSource = '';
try { ignoredSource = execFileSync('git', ['check-ignore', '--no-index', 'src/data/index.ts', 'src/data/snapshot.json'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }); }
catch (error) { if (error.status !== 1) throw error; }
assert.equal(ignoredSource, '', 'Source data module must not be ignored by Git');
const forbidden = [/192\.168\.\d+\.\d+/, /(?:10\.\d+|172\.(?:1[6-9]|2\d|3[01]))\.\d+\.\d+/, /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/, /gh[pousr]_[A-Za-z0-9]{30,}/, /github_pat_[A-Za-z0-9_]{30,}/, /(?:sk-proj-|sk-)[A-Za-z0-9_-]{30,}/];
async function scan(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) await scan(file);
    else if (/\.(?:tsx?|m?js|json|html|css)$/.test(entry.name)) {
      const text = await readFile(file, 'utf8');
      for (const pattern of forbidden) assert.ok(!pattern.test(text), `Potential private information in ${file}; review before publishing`);
    }
  }
}
await scan('src'); await scan('server'); await scan('dist');
console.log('Release checks passed: runtime data excluded; source and build have no private addresses or recognized credentials.');
