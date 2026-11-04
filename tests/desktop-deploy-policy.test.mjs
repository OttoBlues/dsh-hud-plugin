import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const workflow = readFileSync(new URL('../.github/workflows/desktop-deploy.yml', import.meta.url), 'utf8');
const script = readFileSync(new URL('../scripts/windows/desktop-deploy.ps1', import.meta.url), 'utf8');

test('manual Desktop operations do not allow arbitrary source installations', () => {
  assert.match(workflow, /workflow_dispatch:/);
  assert.doesNotMatch(workflow, /^  (push|pull_request|schedule):/m);
  assert.match(workflow, /github\.ref == 'refs\/heads\/main'/);
  assert.match(workflow, /runs-on: \[self-hosted, windows, x64, dsh-hud-test\]/);
  assert.match(workflow, /permissions:\s*\n\s*contents: read/);
  assert.match(workflow, /persist-credentials: false/);
  assert.match(workflow, /options: \[check, install, upgrade, uninstall\]/);
  assert.match(workflow, /node scripts\/verify-channels\.mjs/);
});

test('manual installer reads only released/unstable manifests and checks SHA-256', () => {
  assert.match(script, /ValidateSet\('released', 'unstable'\)/);
  assert.match(script, /Resolve-VettedHudPackage/);
  assert.match(script, /index\.json/);
  assert.match(script, /Get-FileHash -LiteralPath \$archive -Algorithm SHA256/);
  assert.match(script, /'plugin', '--profile', 'desktop', 'add', \$bundle/);
  assert.match(script, /'plugin', '--profile', 'desktop', 'remove', '@local\/dsh-hud'/);
  assert.doesNotMatch(script, /dist\\local-dsh-hud/);
});

test('dangerous state is rejected and earlier packages remain rollback-able', () => {
  assert.match(script, /Desktop must be fully exited/);
  assert.match(script, /\$env:DSH_HOME/);
  assert.match(script, /\\resources\\runtime\\cli\\bin\\dsh\.cmd/);
  assert.match(script, /Get-CimInstance Win32_Process/);
  assert.match(script, /'node_modules\\@local\\dsh-hud\\package\.json'/);
  assert.match(script, /'plugin', '--profile', 'desktop', 'add', \$rollback/);
  assert.match(script, /Remove-Item -LiteralPath \$scratch -Recurse -Force/);
  assert.doesNotMatch(script, /taskkill\.exe|Stop-Process|Start-Process/);
});

test('experimental installers cannot bypass the settings toggle', () => {
  assert.match(script, /\$Channel -eq 'unstable'/);
  assert.match(script, /prefs\.allowUnstable -ne \$true/);
  assert.match(script, /request\.schema -ne 2/);
  assert.match(script, /request\.sha256 -ne \$entry\.sha256/);
});
