import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const workflow = readFileSync(new URL('../.github/workflows/desktop-deploy.yml', import.meta.url), 'utf8');
const script = readFileSync(new URL('../scripts/windows/desktop-deploy.ps1', import.meta.url), 'utf8');

test('Desktop deployment only uses trusted main commit and dedicated runner', () => {
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /push:\s*\n\s*branches: \[main\]\s*\n\s*paths:\s*\n\s*- '\.github\/workflows\/desktop-deploy\.yml'/);
  assert.doesNotMatch(workflow, /^  (pull_request|schedule|repository_dispatch):/m);
  assert.match(workflow, /github\.ref == 'refs\/heads\/main'/);
  assert.match(workflow, /startsWith\(github\.event\.head_commit\.message, 'deploy: install HUD v0\.1\.0 to Desktop'\)/);
  assert.match(workflow, /runs-on: \[self-hosted, windows, x64, dsh-hud-test\]/);
  assert.match(workflow, /permissions:\s*\n\s*contents: read/);
  assert.match(workflow, /persist-credentials: false/);
});

test('Desktop installation refuses wrong CLI, ambiguous profile or active GUI', () => {
  assert.match(script, /\$env:DSH_HOME/);
  assert.match(script, /\\resources\\runtime\\cli\\bin\\dsh\.cmd/);
  assert.match(script, /Get-CimInstance Win32_Process/);
  assert.match(script, /Desktop must be fully exited/);
  assert.match(script, /'\.dsh\\profiles\\desktop\\package\.json'/);
  assert.match(script, /'plugin', '--profile', 'desktop', 'add', \$bundle/);
  assert.match(script, /'plugin', '--profile', 'desktop', 'remove', '@local\/dsh-hud'/);
  assert.doesNotMatch(script, /taskkill\.exe|Stop-Process|Remove-Item .*desktop\\package\.json/);
});

test('Desktop deployment does not publish raw logs or auto-launch GUI', () => {
  assert.match(workflow, /deploy-results\/\*\.json/);
  assert.doesNotMatch(workflow, /\*\.log/);
  assert.match(script, /Remove-Item -LiteralPath \$scratch -Recurse -Force/);
  assert.doesNotMatch(script, /Start-Process|Invoke-WebRequest/);
});
