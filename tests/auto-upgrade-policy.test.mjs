import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';

const flow = readFileSync(new URL('../.github/workflows/auto-upgrade.yml', import.meta.url), 'utf8');
const probe = readFileSync(new URL('../scripts/windows/auto-upgrade-probe.ps1', import.meta.url), 'utf8');
const desktop = readFileSync(new URL('../scripts/windows/desktop-deploy.ps1', import.meta.url), 'utf8');

test('auto-upgrade is gated on completed successful push CI for current main', () => {
  assert.match(flow, /workflow_run:/);
  assert.match(flow, /workflows: \['DSH plugins CI'\]/);
  assert.match(flow, /types: \[completed\]/);
  assert.match(flow, /branches: \[main\]/);
  assert.doesNotMatch(flow, /^  pull_request:/m);
  assert.match(flow, /source\.event !== 'push'/);
  assert.match(flow, /source\.head_sha !== sha/);
  assert.match(flow, /source\.conclusion !== 'success'/);
  assert.match(flow, /source\.head_repository\?\.full_name !== 'OttoBlues\/dsh-plugins'/);
  assert.match(flow, /workflow_id: 'ci\.yml'/);
  assert.match(flow, /run\.event === 'push'/);
  assert.match(flow, /run\.conclusion === 'success'/);
  assert.match(flow, /permissions:\s*\n\s*actions: read\s*\n\s*contents: read/);
  assert.match(flow, /persist-credentials: false/);
});

test('deferred upgrade retries hourly but never force quits running DSH', () => {
  assert.match(flow, /schedule:\s*\n\s*- cron: '23 \* \* \* \*'/);
  assert.match(flow, /concurrency:\s*\n\s*group: dsh-hud-self-hosted\s*\n\s*cancel-in-progress: false/);
  assert.match(flow, /runs-on: \[self-hosted, windows, x64, dsh-hud-test\]/);
  assert.match(probe, /Get-CimInstance Win32_Process/);
  assert.match(probe, /'deferred'/);
  assert.match(probe, /keep current plugin until it exits/);
  assert.doesNotMatch(probe, /Stop-Process|taskkill\.exe|Start-Process/);
});

test('probe is idempotent, version-aware and respects manual uninstall', () => {
  assert.match(probe, /'node_modules\\@local\\dsh-hud\\package\.json'/);
  assert.match(probe, /'\.dsh\\profiles\\desktop'/);
  assert.match(probe, /\$activeBundles -contains '@local\/dsh-hud'/);
  assert.match(probe, /HUD has been uninstalled; automation respects that choice/);
  assert.match(probe, /\$currentVersion -ge \$targetVersion/);
  assert.match(probe, /\$report\.needed = \$true/);
  assert.match(probe, /needed='/);
  assert.match(flow, /steps\.probe\.outputs\.needed == 'true'/);
  assert.match(flow, /desktop-deploy\.ps1 -Mode upgrade/);
});

test('installer keeps a local rollback package and checks exact deployed version', () => {
  assert.match(desktop, /\$tarCommand\.Source -czf \$rollback -C \$stageRoot package/);
  assert.match(desktop, /Copy-Item -LiteralPath \$locale -Destination \$stagePackage -Recurse -Force/);
  assert.match(desktop, /\$tarEntries -contains 'package\/package\.json'/);
  assert.match(desktop, /prior\.version/);
  assert.match(desktop, /'plugin', '--profile', 'desktop', 'add', \$bundle/);
  assert.match(desktop, /'plugin', '--profile', 'desktop', 'add', \$rollback/);
  assert.match(desktop, /\$installed\.version -ne \$targetVersion/);
  assert.match(desktop, /Record 'rollback' 'passed'/);
});

test('auto workflow uploads only structured status artifacts', () => {
  assert.match(flow, /auto-results\/\*\.json/);
  assert.match(flow, /deploy-results\/\*\.json/);
  assert.doesNotMatch(flow, /\*\.log/);
  assert.match(probe, /ConvertTo-Json -Depth 6/);
});
