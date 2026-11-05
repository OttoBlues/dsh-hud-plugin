import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const host = readFileSync(new URL('../plugins/hud/index.js',import.meta.url),'utf8');
const client = readFileSync(new URL('../plugins/hud/client.js',import.meta.url),'utf8');
const catalog = JSON.parse(readFileSync(new URL('../plugins/index.json',import.meta.url),'utf8'));

test('Host and Client v0.5.4 development source parse successfully',()=>{
  for(const file of ['plugins/hud/index.js','plugins/hud/client.js']){
    const out=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});
    assert.equal(out.status,0,out.stderr);
  }
});
test('DSH HUD is an independent sidebar plugin, not a native Plugins tab',()=>{
  assert.match(client,/ctx\.slots\.inject\('sidebar\.panellist'/);
  assert.match(client,/ctx\.slots\.inject\('main'/);
  assert.match(client,/name:'main',key:PANEL/);
  assert.match(client,/id:PANEL,order:5/);
  assert.doesNotMatch(client,/ctx\.slots\.inject\('plugins\.tab'/);
});
test('anonymous public repo catalog enumerates all valid repository components',()=>{
  assert.equal(catalog.schema,1);
  assert(Array.isArray(catalog.components));
  assert(catalog.components.some(x=>x.id==='hud'&&x.name==='@local/dsh-hud'));
  assert.match(host,/readJSON\(root, 'index\.json', signal\)/);
  assert.match(host,/dsh-hud-plugin\/main\/plugins/);
  assert.match(host,/dsh-plugins\/main\/plugins/);
  assert.match(host,/\['released','unstable'\]\.map/);
  assert.match(host,/selected\.root \+ '\/' \+ component\.id/);
  assert.doesNotMatch(host+client,/GITHUB_TOKEN|gh auth|child_process|powershell\.exe/);
});
test('only listed released/unstable archives can be installed',()=>{
  assert.match(host,/item\.acceptance\?\.decision !== 'approved'/);
  assert.match(host,/item\.test\?\.result !== 'success'/);
  assert.match(host,/createHash\('sha256'\)\.update\(bytes\)\.digest\('hex'\)/);
  assert.match(host,/ctx\.pluginManager\.installBundle\(target, \{/);
  assert.match(host,/saveExact: true/);
  assert.match(host,/const nonce = config\.requestNonce\.get\(\)/);
  assert.match(host,/requestNonce:'', updateStatus:'installing'/);
  assert.match(host,/ctx\.pluginManager\.listBundles\(\)/);
  assert.match(host,/AbortSignal\.timeout\(TIMEOUT_MS\)/);
});
test('auto updates default off and experimental auto needs 3 explicit opt-ins',()=>{
  assert.match(host,/autoUpdateEnabled: Schema\.boolean\(\)\.default\(false\)\.volatile\(\)/);
  assert.match(host,/allowUnstable: Schema\.boolean\(\)\.default\(false\)\.volatile\(\)/);
  assert.match(host,/autoUpdateUnstable: Schema\.boolean\(\)\.default\(false\)\.volatile\(\)/);
  assert.match(host,/config\.allowUnstable\.get\(\) === true &&\s*config\.autoUpdateUnstable\.get\(\) === true/);
  assert.match(host,/if \(!row\) continue; \/\/ Never silently install a new component/);
  assert.match(host,/autoAttemptKey:key/);
});
test('retired Windows Runner deployment workflows cannot be triggered',()=>{
  for(const file of [
    '../.github/workflows/bootstrap-hud-v03.yml',
    '../.github/workflows/prepare-unstable-v03.yml',
    '../.github/workflows/auto-upgrade.yml',
    '../.github/workflows/desktop-deploy.yml',
    '../.github/workflows/self-hosted-smoke.yml',
    '../scripts/windows/desktop-deploy.ps1',
    '../scripts/windows/stage-channels.ps1',
    '../scripts/windows/auto-upgrade-probe.ps1',
    '../scripts/windows/self-hosted-smoke.ps1',
  ]) assert.equal(existsSync(new URL(file,import.meta.url)),false,file);
  const ci=readFileSync(new URL('../.github/workflows/ci.yml',import.meta.url),'utf8');
  assert.match(ci,/runs-on: ubuntu-24\.04/);
  assert.match(ci,/runs-on: windows-2025/);
  assert.doesNotMatch(ci,/self-hosted|desktop-deploy|upload-artifact/);
  assert.equal(ci.includes('scripts/windows/'),false);
});

test('full-frame HUD is opt-in, safe to exit, and leaves native DSH root intact',()=>{
  assert.match(host,/hudMode: Schema\.boolean\(\)\.default\(false\)\.volatile\(\)/);
  assert.match(client,/data-dsh-hud-workspace/);
  assert.doesNotMatch(client,/data-dsh-hud-switcher/);
  assert.match(client,/data-hud-enter-mode/);
  assert.match(client,/ctx\.layout\.selectPanel\(null\)/);
  assert.match(client,/ctx\.layout\.selectPanel\(PANEL\)/);
  assert.match(client,/pointerEvents:'auto'/);
  assert.match(client,/useSessions\(x => x\)/);
  assert.match(client,/useSessionStatus\(x => x\)/);
  assert.doesNotMatch(client,/ctx\.slots\.inject\('root'/);
});


test('one-click checks use the Host allowlisted source and cannot auto-install',()=>{
  assert.match(host,/checkNonce: Schema\.string\(\)\.default\(''\)\.volatile\(\)/);
  assert.match(host,/checkState: Schema\.string\(\)\.default\('idle'\)\.volatile\(\)/);
  assert.match(host,/async function processCheckRequest\(\)/);
  assert.match(host,/await discover\(true,nonce\)/);
  assert.match(host,/if \(!manual && config\.autoUpdateEnabled\.get\(\) === true/);
  assert.match(client,/data-hud-check-button/);
  assert.match(client,/data-hud-check-state/);
  assert.match(client,/data-hud-check-error/);
  assert.doesNotMatch(client,/fetch\(/);
});

test('HUD panels use fixed-pixel geometry while management inherits DSH theme',()=>{
  assert.match(client,/function cockpitPanel\(/);
  assert.match(client,/data-hud-cockpit-panel/);
  assert.match(client,/data-hud-panel-liner/);
  assert.doesNotMatch(client,/data-hud-panel-cap/);
  assert.match(client,/data-hud-header-rule/);
  assert.match(client,/data-hud-management-theme':'dsh-native/);
  assert.doesNotMatch(client,/preserveAspectRatio:'none'/);
  assert.doesNotMatch(client,/function vectorTraces\(/);
  assert.doesNotMatch(client,/function scopeLines\(/);
  assert.doesNotMatch(client,/function vectorFrame\(/);
});

test('bounded scanning and UI recovery prevent infinite updating states',()=>{
  assert.match(host,/AbortSignal\.timeout\(SCAN_MS\)/);
  assert.match(host,/Promise\.race\(\[edit,timeout\]\)/);
  assert.match(host,/lastCheckNonce/);
  assert.match(host,/scanAt:new Date\(\)\.toISOString\(\)/);
  assert.match(client,/CHECK_WATCHDOG_MS/);
  assert.match(client,/checkTimedOut/);
  assert.match(client,/checkQueuedAt/);
  assert.match(client,/data-hud-check-state/);
});

test('flat cockpit uses one line and panel color; entry only in Component Center',()=>{
  const cockpit=client.slice(client.indexOf('const V ='),client.indexOf('function makeOverlay'));
  assert.doesNotMatch(cockpit,/gradient\(|boxShadow:|textShadow:'0/);
  assert.match(cockpit,/outer:'#6dcbd2'/);
  assert.match(cockpit,/inner:'#142b3a'/);
  assert.match(cockpit,/background:'#071522'/);
  assert.doesNotMatch(client,/data-dsh-hud-switcher/);
  assert.match(client,/data-hud-enter-mode/);
  assert.match(client,/name:'shell\.overlay'/);
});


test('a transient missing ConfigEditor cannot permanently consume a check request',()=>{
  assert.match(host,/const editor = ctx\.get\('configEditor'\)/);
  assert.match(host,/const entry = ctx\.fiber\?\.entry/);
  assert.match(host,/retryCheckAfter = Date\.now\(\) \+ 3_000/);
  assert.match(host,/lastCheckNonce = nonce;/);
  assert.match(host,/if \(!completed && !disposed && config\.checkNonce\.get\(\) === nonce\)/);
  assert.match(host,/HUD manual check could not be claimed/);
});
