import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const workflow = readFileSync(new URL('../.github/workflows/desktop-deploy.yml', import.meta.url), 'utf8');
const script = readFileSync(new URL('../scripts/windows/desktop-deploy.ps1', import.meta.url), 'utf8');

test('Desktop deployment is manual-only, main-only and runner-labeled', () => {
  assert.match(workflow, /workflow_dispatch:/);
  assert.doesNotMatch(workflow, /^  (push|pull_request|schedule|repository_dispatch):/m);
  assert.match(workflow, /github\.ref == 'refs\/heads\/main'/);
  assert.match(workflow, /runs-on: \[self-hosted, windows, x64, dsh-hud-test\]/);
  assert.match(workflow, /permissions:\s*\n\s*contents: read/);
  assert.match(workflow, /persist-credentials: false/);
  assert.match(workflow, /options: \[check, install, upgrade, uninstall\]/);
});

test('install and upgrade require separate explicit modes and a versioned Bundle', () => {
  assert.match(workflow, /inputs.mode == 'install' \|\| inputs.mode == 'upgrade'/);
  assert.match(script, /ValidateSet\('check', 'install', 'upgrade', 'uninstall'\)/);
  assert.match(script, /'dist\\local-dsh-hud-' \+ \$targetVersion \+ '\.tgz'/);
  assert.match(script, /'plugin', '--profile', 'desktop', 'add', \$bundle/);
  assert.match(script, /'node_modules\\@local\\dsh-hud\\package\.json'/);
  assert.match(script, /\$installed\.version -ne \$targetVersion/);
  assert.match(script, /overall = 'pending'/);
});

test('deployment refuses wrong CLI, ambiguous profile and active Desktop', () => {
  assert.match(script, /\$env:DSH_HOME/);
  assert.match(script, /\\resources\\runtime\\cli\\bin\\dsh\.cmd/);
  assert.match(script, /Get-CimInstance Win32_Process/);
  assert.match(script, /Desktop must be fully exited/);
  assert.match(script, /'\.dsh\\profiles\\desktop\\package\.json'/);
  assert.match(script, /'plugin', '--profile', 'desktop', 'remove', '@local\/dsh-hud'/);
  assert.doesNotMatch(script, /taskkill\.exe|Stop-Process|Remove-Item .*desktop\\package\.json/);
});

test('deployment does not publish raw logs or auto-launch the GUI', () => {
  assert.match(workflow, /deploy-results\/\*\.json/);
  assert.doesNotMatch(workflow, /\*\.log/);
  assert.match(script, /Remove-Item -LiteralPath \$scratch -Recurse -Force/);
  assert.doesNotMatch(script, /Start-Process|Invoke-WebRequest/);
});
