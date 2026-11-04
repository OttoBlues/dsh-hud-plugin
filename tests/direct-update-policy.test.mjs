import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';

const host = readFileSync(new URL('../plugins/hud/index.js', import.meta.url), 'utf8');
const client = readFileSync(new URL('../plugins/hud/client.js', import.meta.url), 'utf8');

test('Host and browser plugin files are valid JavaScript', () => {
  for (const path of ['plugins/hud/index.js', 'plugins/hud/client.js']) {
    const result = spawnSync(process.execPath, ['--check', path], {encoding:'utf8'});
    assert.equal(result.status, 0, result.stderr);
  }
});

test('anonymous released and unstable indexes only; no GitHub token in Host or Client', () => {
  assert.match(host, /https:\/\/raw\.githubusercontent\.com\/OttoBlues\/dsh-plugins\/main\/plugins\/hud/);
  assert.match(host, /for \(const channel of \['released', 'unstable'\]\)/);
  assert.match(host, /channel === 'unstable' && config\.allowUnstable\.get\(\) !== true/);
  assert.match(host, /row\.acceptance\?\.decision !== 'approved'/);
  assert.match(host, /row\.test\?\.result !== 'success'/);
  assert.doesNotMatch(host+client, /GITHUB_TOKEN|gh auth|child_process|execFile|powershell\.exe/);
});

test('real installer is gated on explicit component confirmation, version and sha256', () => {
  assert.match(host, /const nonce = config\.requestNonce\.get\(\)/);
  assert.match(host, /nonce === lastRequest/);
  assert.match(host, /isNewer|newer\(version, CURRENT_VERSION\)/);
  assert.match(host, /row\.file !== 'v' \+ row\.version/);
  assert.match(host, /createHash\('sha256'\)\.update\(content\)\.digest\('hex'\)/);
  assert.match(host, /ctx\.pluginManager\.installBundle\(archive, \{ enabled: true \}\)/);
  assert.match(host, /result\.application === 'restart-required'/);
  assert.match(client, /path: \['requestNonce'\]/);
});

test('source-only CI cannot authorize an unstable install automatically', () => {
  const flow = readFileSync(new URL('../.github/workflows/prepare-unstable-v03.yml', import.meta.url), 'utf8');
  assert.match(flow, /github\.event\.head_commit\.message == 'build: HUD v0\.3\.0 trial candidate'/);
  assert.match(flow, /npm run check/);
  assert.match(flow, /npm run verify:pack/);
  assert.doesNotMatch(flow, /actions\/upload-artifact|plugin --profile desktop add/);
});
