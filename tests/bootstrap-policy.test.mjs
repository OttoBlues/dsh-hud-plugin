import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';

const flow = readFileSync(new URL('../.github/workflows/bootstrap-hud-v03.yml', import.meta.url), 'utf8');
const installer = readFileSync(new URL('../scripts/windows/desktop-deploy.ps1', import.meta.url), 'utf8');

test('one-time bootstrapping requires an exact user-approved main commit and green CI', () => {
  assert.match(flow, /workflow_run:/);
  assert.match(flow, /source|run\.head_sha !== sha/);
  assert.match(flow, /run\.conclusion !== 'success'/);
  assert.match(flow, /commit\.data\.commit\.message\.trim\(\) !== 'bootstrap: install HUD v0\.3\.0 unstable once'/);
  assert.match(flow, /workflow_id:'ci\.yml'/);
  assert.match(flow, /runs-on: \[self-hosted, windows, x64, dsh-hud-test\]/);
});

test('Windows steps never use third-party Actions; only own vetted Git source', () => {
  const windows = flow.slice(flow.indexOf('  desktop-bootstrap:'));
  assert.doesNotMatch(windows, /uses:/);
  assert.match(windows, /git -c "http\.extraheader=AUTHORIZATION: basic \$auth" fetch/);
  assert.match(windows, /\$actual -ne \$env:BOOTSTRAP_SHA/);
  assert.match(windows, /node scripts\/verify-channels\.mjs/);
  assert.match(windows, /self-hosted-smoke\.ps1 -Mode install-smoke -Channel unstable/);
  assert.match(windows, /desktop-deploy\.ps1 -Mode upgrade -Channel unstable -TargetVersion 0\.3\.0 -BootstrapV03/);
  assert.doesNotMatch(windows, /Stop-Process|taskkill\.exe/);
});

test('bootstrap is a one-time narrow exception, not a universal unstable override', () => {
  assert.match(installer, /switch\] \$BootstrapV03/);
  assert.match(installer, /\$Channel -eq 'unstable' -and \$TargetVersion -eq '0\.3\.0'/);
  assert.match(installer, /\$env:GITHUB_WORKFLOW -eq 'DSH HUD v0\.3 one-time bootstrap'/);
  assert.match(installer, /\$BootstrapV03 -and -not \$bootstrapAllowed/);
  assert.match(installer, /\$Channel -eq 'unstable' -and -not \$bootstrapAllowed/);
  assert.match(installer, /request\.schema -ne 2/);
});

test('desktop install is gated by temporary-profile verification and exact version check', () => {
  const webIndex = flow.indexOf('Smoke-test V0.3 in a temporary DSH Web Profile');
  const desktopIndex = flow.indexOf('Install authorized V0.3 into existing Desktop Profile');
  assert(webIndex > 0 && desktopIndex > webIndex);
  assert.match(flow, /\$pkg\.version -ne '0\.3\.0'/);
  assert.match(flow, /Desktop is open\. This task will retry/);
});
