import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const host = readFileSync(new URL('../plugins/hud/index.js',import.meta.url),'utf8');
const client = readFileSync(new URL('../plugins/hud/client.js',import.meta.url),'utf8');
const catalog = JSON.parse(readFileSync(new URL('../plugins/index.json',import.meta.url),'utf8'));

test('Host and Client development source parse successfully',()=>{
  for(const file of ['plugins/hud/index.js','plugins/hud/client.js']){
    const out=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});
    assert.equal(out.status,0,out.stderr);
  }
});
test('Host and Client report the plugin package version',()=>{
  const version=JSON.parse(readFileSync(new URL('../plugins/hud/package.json',import.meta.url),'utf8')).version;
  assert(host.includes(`const HOST_VERSION = '${version}'`));
  assert(client.includes(`const VERSION = '${version}'`));
});

test('obsolete CI publisher steps cannot stage missing archives for a different source version',()=>{
  const ci=readFileSync(new URL('../.github/workflows/ci.yml',import.meta.url),'utf8');
  const sections=ci.split('name: Record validated Unstable package without changing Released');
  assert.equal(sections.length,3);
  const gitExec=spawnSync('git',['--exec-path'],{encoding:'utf8'});
  assert.equal(gitExec.status,0,gitExec.stderr);
  const bash=process.platform==='win32'
    ? resolve(gitExec.stdout.trim(),'../../..','bin','bash.exe') : 'bash';
  for(const [index,version] of ['0.5.10','0.5.12'].entries()){
    const block=sections[index+1].split('run: |')[1].split(/\r?\n\r?\n/)[0]
      .replace(/^ {10}/gm,'');
    const fake='node() { printf "%s\\n" "$HUD_TEST_VERSION"; }\n'+
      'git() { if [ "$1" = "ls-files" ]; then return 1; fi; printf "git %s\\n" "$*"; }\n';
    const run=source=>spawnSync(bash,['-e','-c',fake+block],{
      encoding:'utf8',env:{...process.env,HUD_TEST_VERSION:source},
    });
    const inactive=run('0.5.15');
    assert.equal(inactive.status,0,inactive.stderr);
    assert.equal(inactive.stdout.trim(),'','A mismatched publisher must not invoke git');
    const active=run(version);
    assert.equal(active.status,0,active.stderr);
    assert(active.stdout.includes('git add plugins/hud/unstable/index.json plugins/hud/unstable/v'+version+'/'));
  }
});
test('Host RPC uses exact authenticated routes on the shared Connection API',()=>{
  assert.match(host,/ctx\.connection\.fetch\.register\(nativeRpcRoute\('open'/);
  assert.match(host,/path: '\/api\/' \+ method/);
  assert.match(host,/requestBody: 'buffered'/);
  assert.doesNotMatch(host,/\.rpc\.handle\('\/hud-native'/);
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
  assert.match(host,/pluginManager\(\)\.installBundle\(target, \{/);
  assert.match(host,/saveExact: true/);
  assert.match(host,/const nonce = config\.requestNonce\.get\(\)/);
  assert.match(host,/requestNonce:'', updateStatus:'installing'/);
  assert.match(host,/pluginManager\(\)\.listBundles\(\)/);
  assert.match(host,/AbortSignal\.timeout\(TIMEOUT_MS\)/);
});
test('auto updates default off and experimental auto needs 3 explicit opt-ins',()=>{
  assert.match(host,/autoUpdateEnabled: Schema\.boolean\(\)\.default\(false\)\.volatile\(\)/);
  assert.match(host,/allowUnstable: Schema\.boolean\(\)\.default\(false\)\.volatile\(\)/);
  assert.match(host,/autoUpdateUnstable: Schema\.boolean\(\)\.default\(false\)\.volatile\(\)/);
  assert.match(host,/config\.allowUnstable\.get\(\) === true &&\s*config\.autoUpdateUnstable\.get\(\) === true/);
  assert.match(host,/if \(!row\) continue; \/\/ Never silently install a new component/);
  assert.match(host,/autoLedgerFor/);
  assert.match(host,/verifiedPackagePath\(component,approved,signal\)/);
  assert.match(host,/await writeFile\(temporaryLedger/);
  assert.match(host,/await rename\(temporaryLedger,ledgerPath\)/);
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
  assert.match(host,/await discover\(true,\s*nonce\)/);
  assert.match(host,/if \(!manual && config\.autoUpdateEnabled\.get\(\) === true/);
  assert.match(client,/data-hud-check-button/);
  assert.match(client,/data-hud-check-state/);
  assert.match(client,/data-hud-check-error/);
  assert.match(client,/async function checkPublicReleases\(\)/);
  assert.match(client,/credentials:'omit'/);
  assert.match(client,/redirect:'error'/);
  assert.match(client,/mode:'cors'/);
  assert.match(client,/raw\.githubusercontent\.com\/OttoBlues\/dsh-hud-plugin\/main\/plugins/);
  const check=client.slice(client.indexOf('const requestCheck=async'),client.indexOf('const checkLabel='));
  assert.doesNotMatch(check,/form\.mutate|form\.set/,'Read-only checks must not persist DSH settings');
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
  assert.match(client,/AbortSignal\.timeout\(14_000\)/);
  assert.match(client,/checkPublicReleases\(\)/);
  assert.match(client,/setDirectCheck/);
  assert.match(client,/data-hud-check-state/);
  assert.doesNotMatch(client,/checkTimedOut/);
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
  assert.match(host,/editor\.entries\(\)/);
  assert.match(host,/row\.options\?\.id === 'dsh-hud'/);
  assert.match(host,/loader\/volatile-update/);
  assert.match(host,/retryCheckAfter = Date\.now\(\) \+ 3_000/);
  assert.match(host,/lastCheckNonce = nonce;/);
  assert.match(host,/if \(!completed && !disposed && config\.checkNonce\.get\(\) === nonce\)/);
  assert.match(host,/HUD Host received manual check request/);
});


test('manual release scanning persists results in one authoritative settings edit',()=>{
  const code=host.slice(host.indexOf('async function processCheckRequest()'),host.indexOf('async function processManualRequest()'));
  assert.match(code,/await discover\(true,\s*nonce\)/);
  assert.doesNotMatch(code,/writeSettings\(\{ checkState:'checking'/);
  assert.match(host,/editor\.entries\(\)/);
  assert.match(host,/ctx\.on\?\.\('loader\/volatile-update'/);
});

test('native window launch uses authenticated Connection API RPC, never volatile settings as a command bus',()=>{
  assert.match(host,/inject = \['connection'\]/);
  assert.match(host,/ctx\.connection\.fetch\.register\(nativeRpcRoute\('open'/);
  assert.match(host,/ctx\.connection\.browserPeer/);
  assert.match(host,/peer\?\.principal\?\.kind !== 'owner'/);
  assert.match(client,/ctx\.connection\.rpc\.call\('\/api', 'hud-native\.open'/);
  assert.match(client,/abort\.abort\(\)/);
  const launch=client.slice(client.indexOf('const launchNativeHud = async'),
    client.indexOf('const queue = async'));
  assert.doesNotMatch(launch,/form\.(set|mutate)/);
  assert.doesNotMatch(host,/processNativeHudRequest|lastNativeHudNonce/);
});


test('direct, SHA-pinned install preparation never mutates Loader profile config',()=>{
  assert.match(host,/async function prepareInstall\(/);
  assert.match(host,/nativeRpcRoute\('prepare-install',\s*\(payload, signal, peer\) => prepareInstall/);
  assert.match(host,/sha256:approved\.sha256/);
  const prepared=host.slice(host.indexOf('async function prepareInstall('),
    host.indexOf('// Use official Connection unary RPC',host.indexOf('async function prepareInstall(')));
  assert.doesNotMatch(prepared,/writeSettings\(/);
  assert.match(client,/ctx\.connection\.rpc\.call\('\/api','hud-native\.prepare-install'/);
  const manual=client.slice(client.indexOf('const queue = async'),
    client.indexOf('const checkState=directCheck.state'));
  assert.match(manual,/ctx\.remote\.pluginManager\.installBundle\(facts\.path/);
  assert.match(manual,/facts\.sha256!==candidate\.sha256/);
  assert.doesNotMatch(manual,/form\.(mutate|set)/);
});

test('manual install receives official DSH application result or displays unconfirmed, never stuck queued',()=>{
  assert.match(client,/INSTALL_WAIT_MS = 90_000/);
  assert.match(client,/application==='restart-required'/);
  assert.match(client,/data-hud-install-stale/);
  assert.match(client,/data-hud-clear-pending/);
  assert.match(client,/data-hud-legacy-stale/);
  assert.match(client,/data-hud-host-mismatch/);
  assert.match(host,/nativeRpcRoute\('status'/);
  assert.match(host,/hostVersion:HOST_VERSION/);
  assert.match(host,/runtime\.scanAt/);
  assert.doesNotMatch(host.slice(host.indexOf('async function discover('),
    host.indexOf('async function processCheckRequest()')),/if \(!manual\)\s*await writeSettings/);
});


test('HUD Host has only one mandatory service and does not block settings on optional Plugin Manager',()=>{
  assert.match(host,/export const inject = \['connection'\]/);
  assert.match(host,/ctx\.get\('pluginManager'\)/);
  assert.match(host,/ctx\.connection\.fetch\.register\(nativeRpcRoute\('status'/);
  assert.doesNotMatch(host,/export const inject = \[[^\]]*'pluginManager'/);
  assert.doesNotMatch(host,/export const inject = \[[^\]]*'webServer'/);
});
test('public index is fetched on initial page mount without writing Host config',()=>{
  assert.match(client,/React\.useEffect\(\(\)=>\{void requestCheck\(\);\},\[\]\)/);
  assert.match(client,/state:'checking',at:'',error:''/);
  assert.match(client,/data-hud-source':checkState==='checking'/);
  assert.match(client,/sourceNetworkError/);
  assert.doesNotMatch(client,/Make the GitHub repository Public to enable direct updates/);
});
test('all update-policy controls show writable state and explicit settings failure',()=>{
  assert.match(client,/data-hud-policy-health/);
  assert.match(client,/data-hud-policy-error/);
  assert.match(client,/data-hud-policy-saved/);
  assert.match(client,/current\.writable!==true/);
  assert.match(client,/if\(accepted!==true\)throw/);
  const main=client.slice(client.indexOf("function makeMainPage("));
  assert.doesNotMatch(main,/value=>form\.set\('autoUpdate/);
});
