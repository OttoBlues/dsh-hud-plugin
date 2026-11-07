import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { PassThrough } from 'node:stream';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { HUD_STARTUP_TIMEOUT_MS, launchWindowsHud, safeNativeSnapshot } from '../plugins/hud/native-window.js';

const windowsHudScript=readFileSync(new URL('../plugins/hud/native/windows-hud.ps1',import.meta.url),'utf8');
const hudClientSource=readFileSync(new URL('../plugins/hud/client.js',import.meta.url),'utf8');

test('WPF helper has a UTF-8 BOM for Windows PowerShell 5.1',()=>{
  const bytes=readFileSync(new URL('../plugins/hud/native/windows-hud.ps1',import.meta.url));
  assert.equal(bytes.subarray(0,3).toString('hex'),'efbbbf');
});

test('WPF window recovery targets only the DSH main BrowserWindow and reports failures',()=>{
  const script=windowsHudScript.replace(/^\uFEFF/,'');
  assert.match(script,/string\.Equals\(cls\.ToString\(\),\s*"Chrome_WidgetWin_1"/);
  assert.doesNotMatch(script,/StartsWith\("Chrome_WidgetWin_"/);
  assert.match(script,/ERROR: No unique DSH main window could be restored/);
  assert.match(script,/ERROR: DSH main window remains hidden after restore/);
  assert.match(script,/\$target = Find-DshShell \$true/);
  assert.match(script,/\$target = Find-DshShell \$false/);
});

test('Windows verifies Desktop parent, executable and process lifetime',
  {skip:process.platform!=='win32'},()=>{
    const script=fileURLToPath(new URL('../plugins/hud/native/windows-hud.ps1',import.meta.url));
    const output=execFileSync('powershell.exe',[
      '-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',script,'-SelfTestParentValidation',
    ],{encoding:'utf8',timeout:20_000});
    assert.match(output,/HUD_PARENT_VALIDATION_OK/);
  });

test('Client RPC wait leaves time for the Host WPF startup deadline',()=>{
  const clientTimeoutMs=55_000;
  assert(clientTimeoutMs>HUD_STARTUP_TIMEOUT_MS);
  assert.match(hudClientSource,/setTimeout\(\(\) => abort\.abort\(\), 55_000\)/);
});

function mockSpawner() {
  const launched=[];
  function spawnProcess(binary,args,options) {
    const child=new EventEmitter();
    child.stdin=new PassThrough();
    child.stdout=new PassThrough();
    child.stderr=new PassThrough();
    child.kill=()=>child.emit('exit',1,null);
    child.unref=()=>{};
    const chunks=[];
    child.stdin.on('data',chunk=>chunks.push(Buffer.from(chunk)));
    launched.push({binary,args,options,child,chunks});
    return child;
  }
  return {spawnProcess,launched};
}

test('non-Windows platforms cannot spawn a HUD helper',()=>{
  const {spawnProcess,launched}=mockSpawner();
  assert.throws(()=>launchWindowsHud({platform:'linux',spawnProcess}),/requires DSH Desktop on Windows/);
  assert.equal(launched.length,0);
});

test('snapshot is bounded and strips executable fields and private identifiers',()=>{
  const raw=JSON.stringify({
    accessToken:'DO_NOT_COPY',sessions:Array.from({length:25},(_,i)=>({
      id:'PRIVATE_'+i,token:'SECRET',title:'T'.repeat(120),running:i===0,
    })),
    capturedAt:'2026-11-05T05:00:00.000Z',
  });
  const safe=JSON.parse(safeNativeSnapshot(raw));
  assert.equal(safe.sessions.length,16);
  assert.equal(safe.sessions[0].title.length,100);
  assert.equal(safe.sessions[0].running,true);
  assert.equal(safe.sessions[1].running,false);
  assert.equal(safe.accessToken,undefined);
  assert.doesNotMatch(JSON.stringify(safe),/PRIVATE|SECRET|DO_NOT_COPY/);
  assert.equal(JSON.parse(safeNativeSnapshot('garbage')).sessions.length,0);
});

test('Windows launch uses fixed script and stdin, never session data in shell arguments',()=>{
  const {spawnProcess,launched}=mockSpawner();
  let ready=0,exit=null;
  const native=launchWindowsHud({
    platform:'win32',shellPid:222,hostPid:333,parentPid:444,language:'en',
    snapshot:JSON.stringify({sessions:[{title:'PRIVATE_SESSION_TITLE',running:true}]}),
    onReady:()=>{ready++;},onExit:info=>{exit=info;},spawnProcess,
  });
  assert.equal(launched.length,1);
  const proc=launched[0];
  assert.equal(proc.binary,'powershell.exe');
  assert(proc.args.includes('-STA'));
  assert(proc.args.includes('-File'));
  assert(proc.args.includes('222'));
  assert(proc.args.includes('333'));
  assert.equal(proc.args[proc.args.indexOf('-ParentPid')+1],'444');
  assert(proc.args.includes('en'));
  assert(proc.args.some(x=>x.endsWith('native/windows-hud.ps1') || x.endsWith('native\\windows-hud.ps1')));
  assert.doesNotMatch(proc.args.join(' '),/PRIVATE_SESSION_TITLE/);
  const line=Buffer.concat(proc.chunks).toString('utf8').trim();
  const snapshot=JSON.parse(Buffer.from(line,'base64').toString('utf8'));
  assert.equal(snapshot.sessions[0].title,'PRIVATE_SESSION_TITLE');
  proc.child.stdout.write('READY\n');
  assert.equal(ready,1);
  assert.equal(native.isReady(),true);
  native.close();
  proc.child.emit('exit',0,null);
  assert.equal(exit.ready,true);
  assert.equal(exit.error,'');
  assert.equal(launched.length,1,'A normal return must not spawn a recovery process');
});

test('default Host and its parent are passed to the verified shell resolver',()=>{
  const {spawnProcess,launched}=mockSpawner();
  const native=launchWindowsHud({platform:'win32',spawnProcess});
  const args=launched[0].args;
  assert.equal(args[args.indexOf('-ShellPid')+1],String(process.pid));
  assert.equal(args[args.indexOf('-HostPid')+1],String(process.pid));
  assert.equal(args[args.indexOf('-ParentPid')+1],String(process.ppid));
  native.close();
  launched[0].child.emit('exit',0,null);
});

test('invalid parent PID is rejected before spawning a helper',()=>{
  const {spawnProcess,launched}=mockSpawner();
  assert.throws(()=>launchWindowsHud({platform:'win32',parentPid:-1,spawnProcess}),/Cannot identify/);
  assert.equal(launched.length,0);
});

test('cold WPF startup may report READY after the former 16-second limit',async()=>{
  assert(HUD_STARTUP_TIMEOUT_MS>16_000);
  const {spawnProcess,launched}=mockSpawner();
  let ready=0;
  const native=launchWindowsHud({platform:'win32',spawnProcess,
    startupTimeoutMs:100,shutdownGraceMs:50,onReady:()=>ready++});
  await new Promise(resolve=>setTimeout(resolve,25));
  launched[0].child.stdout.write('READY\n');
  assert.equal(ready,1);
  assert.equal(native.isReady(),true);
  native.close();
  launched[0].child.emit('exit',0,null);
});

test('a READY received after startup timeout is rejected and DSH recovery runs',async()=>{
  const {spawnProcess,launched}=mockSpawner();
  let ready=0,outcome;
  launchWindowsHud({platform:'win32',shellPid:222,hostPid:333,spawnProcess,
    startupTimeoutMs:10,shutdownGraceMs:100,onReady:()=>ready++,onExit:data=>{outcome=data;}});
  await new Promise(resolve=>setTimeout(resolve,20));
  launched[0].child.stdout.write('READY\n');
  assert.equal(ready,0);
  assert.equal(outcome.ready,false);
  assert.match(outcome.error,/startup timed out after 1 s/);
  assert.equal(launched.length,2);
  assert(launched[1].args.includes('-RestoreOnly'));
});

test('abnormal exit after ready invokes dedicated recovery helper',()=>{
  const {spawnProcess,launched}=mockSpawner();
  let exited;
  launchWindowsHud({platform:'win32',shellPid:222,hostPid:333,parentPid:444,
    spawnProcess,onExit:data=>{exited=data;}});
  launched[0].child.stdout.write('READY\n');
  launched[0].child.emit('exit',7,null);
  assert.equal(exited.ready,true);
  assert.match(exited.error,/PowerShell exited/);
  assert.equal(launched.length,2);
  assert.equal(launched[1].binary,'powershell.exe');
  assert(launched[1].args.includes('-RestoreOnly'));
  assert.equal(launched[1].args[launched[1].args.indexOf('-HostPid')+1],'333');
  assert.equal(launched[1].args[launched[1].args.indexOf('-ParentPid')+1],'444');
});

test('startup errors are reported without leaving the DSH shell hidden',()=>{
  const {spawnProcess,launched}=mockSpawner();
  let outcome;
  launchWindowsHud({platform:'win32',shellPid:222,hostPid:333,
    spawnProcess,onExit:data=>{outcome=data;}});
  launched[0].child.stdout.write('ERROR: Cannot identify a unique DSH window.\n');
  launched[0].child.emit('exit',1,null);
  assert.equal(outcome.ready,false);
  assert.match(outcome.error,/Cannot identify/);
  assert.equal(launched.length,2,'A startup failure also attempts safe recovery');
  assert(launched[1].args.includes('-RestoreOnly'));
});
