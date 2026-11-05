/**
 * One-shot release builder for HUD v0.5.12 Unstable.
 * Runs on GitHub-hosted CI after Linux and Windows checks succeed.
 * Never installs to DSH Desktop or changes the Released channel.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root=resolve(fileURLToPath(new URL('..',import.meta.url)));
const version='0.5.12';
const source=process.env.SOURCE_COMMIT || '';
const ciRun=process.env.CI_RUN_ID || '';
const releaseRoot=join(root,'plugins','hud','unstable');
const folder=join(releaseRoot,'v'+version);
const file='local-dsh-hud-'+version+'.tgz';
const indexPath=join(releaseRoot,'index.json');
const pkg=JSON.parse(readFileSync(join(root,'plugins','hud','package.json'),'utf8'));
const index=JSON.parse(readFileSync(indexPath,'utf8'));

if(pkg.version!==version) {
  console.log('HUD source is '+pkg.version+'; v0.5.12 publisher is inactive.');
  process.exit(0);
}
assert.equal(index.component,'hud');
assert.equal(index.channel,'unstable');
assert.equal(index.package,'@local/dsh-hud');
assert(/^[a-f0-9]{40}$/.test(source),'GitHub CI source commit is required.');
assert(/^[0-9]+$/.test(ciRun),'Successful source CI run ID is required.');
if(existsSync(folder)) {
  assert(index.releases.some(x=>x.version===version));
  console.log(version+' already published; immutable archive retained.');
  process.exit(0);
}
assert(index.releases.every(x=>x.version!==version),'A pre-existing release may not be overwritten.');
assert.equal(index.latest,'0.5.10','Unexpected base channel version; refuse stale publisher.');
const packed=join(root,'dist',file);
mkdirSync(join(root,'dist'),{recursive:true});
const result=spawnSync(process.platform==='win32'?'npm.cmd':'npm',
  ['run','pack:hud'],{cwd:root,encoding:'utf8',shell:process.platform==='win32'});
if(result.status!==0)throw new Error('HUD npm pack failed: '+result.stderr);
assert(existsSync(packed),'Pack did not produce the expected v0.5.12 file.');
const bytes=readFileSync(packed);
assert(bytes.length>0 && bytes.length<=25_000_000,'Invalid package size.');
const sha256=createHash('sha256').update(bytes).digest('hex');
const record={
  version,
  file:'v'+version+'/'+file,
  sha256,
  sourceCommit:source,
  test:{ciRun,result:'success'},
  note:'U0512 repair candidate: preserve writable update settings, target and restore the DSH main BrowserWindow, and allow cold WPF startup to report READY within 45 seconds; late READY after timeout is rejected. Real Desktop acceptance remains pending.',
};
const manifest={
  schema:1,component:'hud',package:pkg.name,channel:'unstable',
  version,file,sha256,sourceCommit:source,
  test:{ciRun,result:'success'},
  verification:{sourceCi:ciRun,role:'U0512 update settings, native window selection/recovery, and cold-start timeout fixes; Desktop acceptance pending',
    approvedAsStable:false},
};
mkdirSync(folder,{recursive:false});
copyFileSync(packed,join(folder,file));
writeFileSync(join(folder,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
index.releases.push(record);
index.latest=version;
writeFileSync(indexPath,JSON.stringify(index,null,2)+'\n');
console.log('Published immutable Unstable '+version+' SHA256 '+sha256+' from '+source+' CI '+ciRun);
