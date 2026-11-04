import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';

const workflow = readFileSync(new URL('../.github/workflows/self-hosted-smoke.yml', import.meta.url), 'utf8');
const script = readFileSync(new URL('../scripts/windows/self-hosted-smoke.ps1', import.meta.url), 'utf8');

test('self-hosted workflow is manual-only and confined to main', () => {
  assert.match(workflow, /\bworkflow_dispatch:/);
  assert.doesNotMatch(workflow, /^  (push|pull_request|schedule|repository_dispatch):/m);
  assert.match(workflow, /github\.ref == 'refs\/heads\/main'/);
  assert.match(workflow, /runs-on:\s*\[self-hosted, windows, x64, dsh-hud-test\]/);
  assert.match(workflow, /permissions:\s*\n\s*contents: read/);
  assert.match(workflow, /persist-credentials:\s*false/);
  assert.match(workflow, /concurrency:[\s\S]*cancel-in-progress: false/);
});

test('preflight is the default and install smoke is a separate manual choice', () => {
  assert.match(workflow, /default: preflight/);
  assert.match(workflow, /- install-smoke/);
  assert.match(workflow, /Gate installation on DSH CLI readiness/);
  assert.ok(workflow.indexOf('Gate installation on DSH CLI readiness') < workflow.indexOf('uses: actions/setup-node@v4'));
  assert.match(script, /\$report\.overall = 'needs-setup'/);
  assert.match(script, /\$exitCode = 1/);
  assert.match(script, /\$dshReady = \$true/);
  assert.match(workflow, /if: inputs\.mode == 'install-smoke'/);
  assert.match(workflow, /retention-days: 7/);
});

test('real DSH smoke requires isolated temporary home and never uploads raw logs', () => {
  assert.match(script, /\$env:DSH_HOME = \$temporaryHome/);
  assert.match(script, /--from-default-profile', 'web'/);
  assert.match(script, /'plugin', '--profile', \$profileName, 'add'/);
  assert.match(script, /--no-open --host 127\.0\.0\.1/);
  assert.match(script, /taskkill\.exe/);
  assert.match(script, /Remove-Item -LiteralPath \$temporaryHome -Recurse -Force/);
  assert.match(workflow, /smoke-results\/\*\.json/);
  assert.doesNotMatch(workflow, /\*\.log/);
});
