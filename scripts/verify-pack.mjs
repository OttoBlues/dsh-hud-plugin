import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const dir = join(root, 'dist');
const manifest = JSON.parse(readFileSync(join(root, 'plugins/hud/package.json'), 'utf8'));
const expected = `local-dsh-hud-${manifest.version}.tgz`;
const bundles = readdirSync(dir).filter(file => file === expected);
assert.equal(bundles.length, 1, `Expected ${expected} in dist/`);
const result = spawnSync('tar', ['-tzf', join(dir, expected)], { encoding: 'utf8' });
if (result.error) throw result.error;
assert.equal(result.status, 0, result.stderr);
const paths = result.stdout.trim().split(/\r?\n/);
for (const name of [
  'package/package.json', 'package/index.js', 'package/client.js',
  'package/cordis.patch.yml', 'package/icon.svg',
  'package/native-window.js', 'package/native/windows-hud.ps1',
  'package/locale/en.json', 'package/locale/zh.json',
]) {
  assert(paths.includes(name), `Bundle missing file: ${name}`);
}
assert(!paths.some(path => path.includes('.env') || path.includes('/tests/') || path.includes('/docs/')),
  'Bundle includes a prohibited development file');
console.log(`Verified ${expected} (${paths.length} files)`);
