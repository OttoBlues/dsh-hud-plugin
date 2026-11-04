import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const host = readFileSync(new URL('../plugins/hud/index.js',import.meta.url),'utf8');
const client = readFileSync(new URL('../plugins/hud/client.js',import.meta.url),'utf8');
const catalog = JSON.parse(readFileSync(new URL('../plugins/index.json',import.meta.url),'utf8'));

test('Host and Client v0.4 development source parse successfully',()=>{
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
  assert.match(host,/readJSON\('index\.json', controller\.signal\)/);
  assert.match(host,/\['released','unstable'\]\.map/);
  assert.match(host,/ROOT \+ '\/' \+ component\.id/);
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
test('No prior Windows bootstrap or unapproved source auto-installs remain',()=>{
  assert.equal(existsSync(new URL('../.github/workflows/bootstrap-hud-v03.yml',import.meta.url)),false);
  assert.equal(existsSync(new URL('../.github/workflows/prepare-unstable-v03.yml',import.meta.url)),false);
  const installer=readFileSync(new URL('../scripts/windows/desktop-deploy.ps1',import.meta.url),'utf8');
  assert.doesNotMatch(installer,/BootstrapV03|bootstrapAllowed/);
});
