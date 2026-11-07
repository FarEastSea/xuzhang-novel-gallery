import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, copyFile, readFile, writeFile, rm } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import os from 'node:os';
import { parseVersion } from '../version.mjs';

test('release versions preserve three-part alignment and four-part independent revisions', () => {
  assert.deepEqual(parseVersion('0.7.1'), { version: '0.7.1', studioVersion: '0.7.1', revision: 0, packageVersion: '0.7.1' });
  assert.deepEqual(parseVersion('0.7.1.12'), { version: '0.7.1.12', studioVersion: '0.7.1', revision: 12, packageVersion: '0.7.1+revision.12' });
  for (const value of ['', 'v0.7.1', '0.7', '0.7.01', '0.7.1.0', '0.7.1.1.1', '0.7.1-beta', '0.7.1.9007199254740992']) assert.throws(() => parseVersion(value));
});

test('version commands update all metadata, increment revisions and reject mismatched release tags', async t => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'xuzhang-version-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, 'scripts'));
  for (const file of ['VERSION', 'version.mjs', 'scripts/version.mjs']) await copyFile(file, path.join(root, file));
  await writeFile(path.join(root, 'package.json'), JSON.stringify({ name: 'version-fixture', version: '0.7.1', private: true }));
  await writeFile(path.join(root, 'package-lock.json'), JSON.stringify({ name: 'version-fixture', version: '0.7.1', lockfileVersion: 3, requires: true, packages: { '': { name: 'version-fixture', version: '0.7.1' } } }));
  const run = (args, env = {}) => spawnSync(process.execPath, ['scripts/version.mjs', ...args], { cwd: root, encoding: 'utf8', env: { ...process.env, ...env } });
  assert.equal(run(['set', '0.7.1']).status, 0);
  assert.equal(run(['next']).stdout.trim(), '0.7.1.1');
  assert.equal(run(['next']).stdout.trim(), '0.7.1.2');
  const pkg = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
  const lock = JSON.parse(await readFile(path.join(root, 'package-lock.json'), 'utf8'));
  assert.equal(pkg.version, '0.7.1+revision.2'); assert.equal(lock.version, pkg.version); assert.equal(lock.packages[''].version, pkg.version);
  // Verify the fourth-part public version still permits reproducible npm installs.
  const npm = spawnSync(process.execPath, [process.env.npm_execpath, 'ci', '--ignore-scripts', '--offline', '--no-audit', '--no-fund'], { cwd: root, encoding: 'utf8' });
  assert.equal(npm.status, 0, npm.stderr);
  const output = path.join(root, 'github-output');
  assert.equal(run(['ci'], { GITHUB_REF: 'refs/tags/v0.7.1.2', GITHUB_OUTPUT: output }).status, 0);
  assert.equal((await readFile(output, 'utf8')).trim(), 'version=0.7.1.2');
  assert.notEqual(run(['ci'], { GITHUB_REF: 'refs/tags/v0.7.1', GITHUB_OUTPUT: output }).status, 0);
  assert.equal(run(['set', '0.7.2']).status, 0);
  assert.equal(run(['check']).stdout.trim(), '0.7.2');
  assert.equal(JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8')).version, '0.7.2');
});
