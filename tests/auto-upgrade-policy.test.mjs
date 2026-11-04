import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const flow = readFileSync(new URL('../.github/workflows/auto-upgrade.yml', import.meta.url), 'utf8');
const probe = readFileSync(new URL('../scripts/windows/auto-upgrade-probe.ps1', import.meta.url), 'utf8');
const staged = readFileSync(new URL('../scripts/windows/stage-channels.ps1', import.meta.url), 'utf8');
const desktop = readFileSync(new URL('../scripts/windows/desktop-deploy.ps1', import.meta.url), 'utf8');

test('update worker requires successful main push CI and an explicit click', () => {
  assert.match(flow, /workflow_dispatch:/);
  assert.doesNotMatch(flow, /^  (workflow_run|schedule):/m);
  assert.match(flow, /source\.event !== 'push'/);
  assert.match(flow, /source\.head_sha !== sha/);
  assert.match(flow, /source\.conclusion !== 'success'/);
  assert.match(flow, /workflow_id: 'ci\.yml'/);
  assert.match(flow, /run\.conclusion === 'success'/);
  assert.match(flow, /runs-on: \[self-hosted, windows, x64, dsh-hud-test\]/);
  assert.match(flow, /steps\.probe\.outputs\.needed == 'true'/);
  assert.match(probe, /request\.json/);
  assert.doesNotMatch(flow, /npm run pack:hud|dist\/\*\.tgz/);
});

test('both install channels are source-independent and integrity-checked', () => {
  assert.match(staged, /foreach \(\$channel in @\('released', 'unstable'\)\)/);
  assert.match(staged, /Get-FileHash -LiteralPath \$source -Algorithm SHA256/);
  assert.match(staged, /Get-FileHash -LiteralPath \$tmp -Algorithm SHA256/);
  assert.match(staged, /catalog\.json/);
  assert.doesNotMatch(staged, /npm pack|pnpm pack|dsh plugin|git checkout/);
  assert.match(probe, /plugins\\hud\\/);
  assert.match(probe, /Get-FileHash -LiteralPath \$archive -Algorithm SHA256/);
  assert.match(desktop, /Resolve-VettedHudPackage/);
  assert.match(desktop, /Get-FileHash -LiteralPath \$archive -Algorithm SHA256/);
  assert.doesNotMatch(desktop, /'dist\\local-dsh-hud-'/);
});

test('unstable requires both explicit opt-in and matching user request', () => {
  assert.match(probe, /prefs\.allowUnstable -ne \$true/);
  assert.match(desktop, /prefs\.allowUnstable -ne \$true/);
  assert.match(desktop, /request\.channel -ne \$Channel/);
  assert.match(desktop, /request\.version -ne \$version/);
  assert.match(probe, /\$request\.channel -notin @\('released', 'unstable'\)/);
  assert.match(probe, /experimental-disabled/);
  assert.match(probe, /'no-request'/);
});

test('legacy worker is manual-only and never interrupts DSH Desktop', () => {
  assert.match(flow, /workflow_dispatch:/);
  assert.match(flow, /concurrency:[\s\S]*cancel-in-progress: false/);
  assert.match(probe, /Get-CimInstance Win32_Process/);
  assert.match(probe, /'deferred'/);
  assert.match(desktop, /Desktop must be fully exited/);
  assert.doesNotMatch(probe + desktop, /Stop-Process|taskkill\.exe/);
});

test('updates are reversible and no raw CLI logs are uploaded', () => {
  assert.match(desktop, /\$tarCommand\.Source -czf \$rollback -C \$stageRoot package/);
  assert.match(desktop, /'plugin', '--profile', 'desktop', 'add', \$rollback/);
  assert.match(desktop, /\$installed\.version -ne \$targetVersion/);
  assert.match(flow, /auto-results\/\*\.json/);
  assert.match(flow, /deploy-results\/\*\.json/);
  assert.doesNotMatch(flow, /\*\.log/);
});
