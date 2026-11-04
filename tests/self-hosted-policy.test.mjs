import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';

const workflow = readFileSync(
  new URL('../.github/workflows/self-hosted-smoke.yml', import.meta.url), 'utf8');
const script = readFileSync(
  new URL('../scripts/windows/self-hosted-smoke.ps1', import.meta.url), 'utf8');
const ci = readFileSync(
  new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8');

test('self-hosted workflow is manual-only and confined to main', () => {
  assert.match(workflow, /\bworkflow_dispatch:/);
  assert.doesNotMatch(workflow, /^  (push|pull_request|schedule|repository_dispatch):/m);
  assert.match(workflow, /github\.ref == 'refs\/heads\/main'/);
  assert.match(workflow, /runs-on:\s*\[self-hosted, windows, x64, dsh-hud-test\]/);
  assert.match(workflow, /permissions:\s*\n\s*contents: read/);
  assert.match(workflow, /persist-credentials:\s*false/);
  assert.match(workflow, /cancel-in-progress: false/);
});

test('manual preflight is default and isolated installs require a chosen channel', () => {
  assert.match(workflow, /default: preflight/);
  assert.match(workflow, /- install-smoke/);
  assert.match(workflow, /Gate installation on DSH CLI readiness/);
  assert.match(workflow, /channel:\s*\n\s*description: 'Choose only a vetted release channel/);
  assert.match(workflow, /default: unstable/);
  assert.match(workflow, /REVIEWED_CHANNEL: \$\{\{ inputs\.channel \}\}/);
  assert.match(workflow, /-Channel \$env:REVIEWED_CHANNEL/);
  assert.match(script, /ValidateSet\('released', 'unstable'\)/);
  assert.match(script, /\$report\.overall = 'needs-setup'/);
  assert.match(script, /\$dshReady = \$true/);
});

test('install-smoke refuses unlisted latest-source artifacts', () => {
  assert.match(script, /plugins\\hud\\/);
  assert.match(script, /\$index\.releases \| Where-Object/);
  assert.match(script, /\$index\.latest/);
  assert.match(script, /Get-FileHash -LiteralPath \$fullBundle -Algorithm SHA256/);
  assert.match(script, /Vetted installer SHA-256 mismatch/);
  assert.match(script, /No vetted installer is published in the selected channel/);
  assert.doesNotMatch(script, /\$BundlePath|dist\\local-dsh-hud-0\.1\.0\.tgz/);
  assert.doesNotMatch(workflow, /npm run pack:hud|npm run verify:pack/);
});

test('isolated Web smoke never uploads raw logs or modifies Desktop', () => {
  assert.match(script, /\$env:DSH_HOME = \$temporaryHome/);
  assert.match(script, /--from-default-profile', 'web'/);
  assert.match(script, /'plugin', '--profile', \$profileName, 'add'/);
  assert.match(script, /--no-open --host 127\.0\.0\.1/);
  assert.match(script, /taskkill\.exe/);
  assert.match(script, /Remove-Item -LiteralPath \$temporaryHome -Recurse -Force/);
  assert.match(workflow, /smoke-results\/\*\.json/);
  assert.doesNotMatch(workflow, /\*\.log/);
});

test('regular CI must not publish unapproved HEAD package downloads', () => {
  assert.match(ci, /npm run pack:hud/);
  assert.match(ci, /npm run verify:pack/);
  assert.doesNotMatch(ci, /actions\/upload-artifact@|dsh-hud-bundle-\$\{\{/);
});
