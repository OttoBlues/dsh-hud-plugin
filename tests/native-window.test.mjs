import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { test } from 'node:test';
import { launchWindowsHud, safeNativeSnapshot } from '../plugins/hud/native-window.js';

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
    platform:'win32',shellPid:222,hostPid:333,language:'en',
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

test('abnormal exit after ready invokes dedicated recovery helper',()=>{
  const {spawnProcess,launched}=mockSpawner();
  let exited;
  launchWindowsHud({platform:'win32',shellPid:222,hostPid:333,
    spawnProcess,onExit:data=>{exited=data;}});
  launched[0].child.stdout.write('READY\n');
  launched[0].child.emit('exit',7,null);
  assert.equal(exited.ready,true);
  assert.match(exited.error,/PowerShell exited/);
  assert.equal(launched.length,2);
  assert.equal(launched[1].binary,'powershell.exe');
  assert(launched[1].args.includes('-RestoreOnly'));
  assert(!launched[1].args.includes('-HostPid'));
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
