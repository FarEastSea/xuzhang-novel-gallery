import { readFileSync, writeFileSync, appendFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { parseVersion } from '../version.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const readJson = name => JSON.parse(readFileSync(path.join(root, name), 'utf8'));
const current = () => parseVersion(readFileSync(path.join(root, 'VERSION'), 'utf8').trim());
function check() {
  const value = current();
  const pkg = readJson('package.json');
  const lock = readJson('package-lock.json');
  if (pkg.version !== value.packageVersion || lock.version !== value.packageVersion || lock.packages[''].version !== value.packageVersion) throw new Error('VERSION 与 npm 元数据不一致，请使用 npm run version:set');
  return value;
}
function set(input) {
  const value = parseVersion(input);
  const pkg = readJson('package.json');
  const lock = readJson('package-lock.json');
  pkg.version = value.packageVersion;
  lock.version = value.packageVersion;
  lock.packages[''].version = value.packageVersion;
  writeFileSync(path.join(root, 'VERSION'), value.version + '\n');
  writeFileSync(path.join(root, 'package.json'), JSON.stringify(pkg, null, 2) + '\n');
  writeFileSync(path.join(root, 'package-lock.json'), JSON.stringify(lock, null, 2) + '\n');
  return value;
}

try {
  const [command = 'check', input] = process.argv.slice(2);
  let value;
  if (command === 'set') value = set(input || '');
  else if (command === 'next') {
    const old = check();
    value = set(`${old.studioVersion}.${old.revision + 1}`);
  } else if (command === 'check' || command === 'ci') {
    value = check();
    if (command === 'ci') {
      const ref = process.env.GITHUB_REF || '';
      if (ref.startsWith('refs/tags/') && ref !== `refs/tags/v${value.version}`) throw new Error(`发布标签必须为 v${value.version}`);
      if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `version=${value.version}\n`);
    }
  } else throw new Error('未知版本命令');
  console.log(value.version);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
