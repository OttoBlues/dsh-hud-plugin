import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { setImmediate as tick } from 'node:timers/promises';
import vm from 'node:vm';

const source = readFileSync(new URL('../plugins/hud/index.js',import.meta.url),'utf8')
  .replace(/^import .+;\r?\n/gm,'')
  .replace(/^export const /gm,'const ')
  .replace(/^export function /gm,'function ');
const NAME='@local/dsh-hud';
const archive=Buffer.from('approved DSH plugin fixture - nonexecutable test data');
const sha=createHash('sha256').update(archive).digest('hex');
const commit='a'.repeat(40);
const candidate=(channel,version='0.4.1',hash=sha)=>({
  version,file:'v'+version+'/local-dsh-hud-'+version+'.tgz',
  sha256:hash,sourceCommit:commit,
  ...(channel==='released' ? {acceptance:{check:'U99',decision:'approved',date:'2026-11-04'}} :
    {test:{ciRun:'123456',result:'success'}}),
});
const index=(channel,version,checksum)=>({
  schema:1,component:'hud',package:NAME,channel,
  latest:version || null,releases:version?[candidate(channel,version,checksum)]:[],
});
const repoIndex={schema:1,components:[{
  id:'hud',name:NAME,title:'DSH HUD',description:'HUD and component center',
}]};
const response=(body,status=200)=>{
  const data=Buffer.isBuffer(body)?body:Buffer.from(body);
  return {
    ok:status===200,status,
    headers:{get:k=>k==='content-length'?String(data.length):null},
    body:{getReader(){let done=false;return{
      async read(){if(done)return{done:true};done=true;return{done:false,value:data};},
      async cancel(){},
    };}},
  };
};
async function flush(){for(let i=0;i<10;i++)await tick();}

function setup(overrides={}) {
  const values={
    catalog:'{"schema":3,"source":"checking","components":[]}',
    allowUnstable:false,autoUpdateEnabled:false,autoUpdateUnstable:false,
    autoAttemptKey:'',overlayVisible:false,
    requestComponent:'',requestVersion:'',requestChannel:'released',
    requestNonce:'',updateStatus:'',
    ...overrides.values,
  };
  const calls={http:[],installed:[],list:0,writes:[],logs:[],cached:[]};
  const inventory=overrides.inventory || [{name:NAME,installed:true,version:'0.4.0'}];
  const callbacks=[], startTimers=[];let dispose=()=>{};
  const field=()=>({default(){return this;},volatile(){return this;}});
  const Schema={string:field,boolean:field,object:f=>f};
  const fetch=async(url,opts)=>{
    calls.http.push({url,opts});
    if(overrides.private===true)return response('Not found',404);
    if(overrides.oldNameOnly && url.includes('/dsh-hud-plugin/'))return response('Not found',404);
    if(url.endsWith('/plugins/index.json'))return response(JSON.stringify(repoIndex));
    if(url.endsWith('/hud/released/index.json'))return response(JSON.stringify(
      index('released',overrides.released===undefined?'0.4.1':overrides.released,overrides.badChecksum?'f'.repeat(64):sha)));
    if(url.endsWith('/hud/unstable/index.json'))return response(JSON.stringify(
      index('unstable',overrides.unstable || null)));
    if(url.endsWith('.tgz'))return response(archive);
    return response('missing',404);
  };
  const ctx={
    fiber:{entry:{id:'hud'}},
    get(name){
      if(name!=='configEditor')return;
      return{async edit(_entry,transform){
        const next=transform({...values});
        if(overrides.rejectManualConfigWrite && next.updateStatus==='installing' && next.requestNonce===''){
          throw new Error('Configuration entry is no longer available');
        }
        Object.assign(values,next);calls.writes.push(next);
      }};
    },
    logger:{warn:(...x)=>calls.logs.push(x.join(' ')),info(){}},
    pluginManager:{
      async listBundles(){calls.list++;return inventory;},
      async installBundle(path,opts){
        calls.installed.push({path,opts});
        if(overrides.disposeDuringInstall)dispose();
        const application=overrides.application||'restart-required';
        const version=/\/(0\.4\.\d+)\/[0-9a-f]+\.tgz/.exec(path)?.[1] || '0.4.1';
        if(application==='applied'||application==='restart-required'){
          if(!overrides.wrongInstalledVersion){
            const current=inventory.find(x=>x.name===NAME);
            if(current)current.version=version;
          }
        }
        return{application,bundle:NAME,version:overrides.returnedVersion||version};
      },
    },
    effect:fn=>{dispose=fn();},
  };
  const sandbox={
    Schema,createHash,Buffer,AbortController,AbortSignal,fetch,join,
    homedir:()=>'/home',process:{env:{},pid:999},
    mkdir:async()=>{},writeFile:async(path,data)=>{calls.cached.push({path,data});},
    rename:async()=>{},
    setInterval:fn=>{callbacks.push(fn);return callbacks.length;},
    clearInterval(){},
    setTimeout:fn=>{startTimers.push(fn);return startTimers.length;},
    clearTimeout(){},
  };
  vm.runInNewContext(source+'\n;globalThis.__host={apply};',sandbox);
  const config=Object.fromEntries(Object.keys(values).map(k=>[k,{get:()=>values[k]}]));
  sandbox.__host.apply(ctx,config);
  assert.equal(callbacks.length,2);
  let id=0;
  async function click(channel='released',version='0.4.1'){
    values.requestComponent=NAME;
    values.requestVersion=version;
    values.requestChannel=channel;
    values.requestNonce='confirmed-'+(++id);
    callbacks[1]();
    await flush();
  }
  return {values,calls,inventory,click,refresh:async()=>{callbacks[0]();await flush();},
    reconcile:async()=>{startTimers[0]?.();await flush();},stop:()=>dispose()};
}

test('public repository index exposes components with released and unstable channels',async()=>{
  const s=setup({unstable:'0.4.2'});
  try{
    await flush();
    const catalog=JSON.parse(s.values.catalog);
    assert.equal(catalog.source,'public');
    assert.equal(catalog.components[0].name,NAME);
    assert.equal(catalog.components[0].released.version,'0.4.1');
    assert.equal(catalog.components[0].unstable.version,'0.4.2');
    assert.equal(s.calls.installed.length,0,'Discovering versions must not install');
    assert(s.calls.http.every(x=>x.opts.redirect==='error'&&x.opts.headers.authorization===undefined));
  }finally{s.stop();}
});

test('private repository is identified as unavailable, not up to date',async()=>{
  const s=setup({private:true});
  try{
    await flush();
    assert.equal(JSON.parse(s.values.catalog).source,'unavailable');
    assert.equal(s.calls.installed.length,0);
  }finally{s.stop();}
});

test('manual confirmation is consumed once and checked with exact install facts',async()=>{
  const s=setup();
  try{
    await flush();
    await s.click();
    assert.equal(s.calls.installed.length,1);
    assert.equal(s.calls.installed[0].opts.saveExact,true);
    assert.equal(s.values.requestNonce,'');
    assert.equal(s.values.updateStatus,'installing');
    await s.reconcile();
    assert.equal(s.values.updateStatus,'installed');
    assert.equal(s.calls.cached.length,1);
    assert(s.calls.cached[0].path.includes('.tmp'));
    await s.refresh();
    assert.equal(s.calls.installed.length,1,'No repeated click');
  }finally{s.stop();}
});

test('sha mismatch must refuse before calling DSH pluginManager',async()=>{
  const s=setup({badChecksum:true});
  try{await flush();await s.click();
    assert.equal(s.calls.installed.length,0);
    assert.equal(s.values.updateStatus,'failed');
  }finally{s.stop();}
});

test('overridden result and installed-version mismatch never mean success',async()=>{
  const overridden=setup({application:'overridden'});
  try{await flush();await overridden.click();
    assert.equal(overridden.calls.installed.length,1);
    assert.equal(overridden.values.updateStatus,'failed');
  }finally{overridden.stop();}
  const wrong=setup({wrongInstalledVersion:true});
  try{await flush();await wrong.click();
    assert.equal(wrong.calls.installed.length,1);
    assert.equal(wrong.values.updateStatus,'installing');
    await wrong.reconcile();
    assert.equal(wrong.values.updateStatus,'failed');
  }finally{wrong.stop();}
});

test('automatic updates start disabled and never install new components',async()=>{
  const s=setup({inventory:[],values:{autoUpdateEnabled:true}});
  try{await flush();
    assert.equal(s.calls.installed.length,0);
  }finally{s.stop();}
  const off=setup();
  try{await flush();assert.equal(off.calls.installed.length,0);}
  finally{off.stop();}
});

test('auto update of a released version only after user opt in, one attempt per version',async()=>{
  const s=setup({values:{autoUpdateEnabled:true}});
  try{await flush();
    assert.equal(s.calls.installed.length,1);
    assert.equal(s.values.updateStatus,'installing');
    await s.reconcile();
    assert.equal(s.values.updateStatus,'installed');
    assert.match(s.values.autoAttemptKey,/released:0\.4\.1:/);
    await s.refresh();
    assert.equal(s.calls.installed.length,1);
  }finally{s.stop();}
});

test('experimental versions never auto install unless both additional switches enabled',async()=>{
  const s=setup({unstable:'0.4.2',values:{autoUpdateEnabled:true,allowUnstable:true}});
  try{await flush();
    assert.equal(s.calls.installed.length,1);
    assert.match(s.values.autoAttemptKey,/released:0\.4\.1:/);
  }finally{s.stop();}
  const exp=setup({unstable:'0.4.2',values:{
    autoUpdateEnabled:true,allowUnstable:true,autoUpdateUnstable:true,
  }});
  try{await flush();
    assert.equal(exp.calls.installed.length,1);
    assert.match(exp.values.autoAttemptKey,/unstable:0\.4\.2:/);
  }finally{exp.stop();}
});

test('manual unstable request requires explicit allowUnstable setting',async()=>{
  const s=setup({unstable:'0.4.2'});
  try{await flush();await s.click('unstable','0.4.2');
    assert.equal(s.calls.installed.length,0);
  }finally{s.stop();}
});

test('renamed public repository is preferred; old public name works before rename',async()=>{
  const renamed=setup();
  try{await flush();
    assert(renamed.calls.http.some(x=>x.url.includes('/dsh-hud-plugin/')));
    assert.equal(JSON.parse(renamed.values.catalog).source,'public');
  }finally{renamed.stop();}
  const previous=setup({oldNameOnly:true});
  try{await flush();
    assert(previous.calls.http.some(x=>x.url.includes('/dsh-hud-plugin/')));
    assert(previous.calls.http.some(x=>x.url.includes('/dsh-plugins/')));
    assert.equal(JSON.parse(previous.values.catalog).source,'public');
  }finally{previous.stop();}
});

test('invalidated DSH config entry cannot crash an unawaited timer or install',async()=>{
  const x=setup({rejectManualConfigWrite:true});
  try{await flush();await x.click();
    assert.equal(x.calls.installed.length,0);
    assert.notEqual(x.values.updateStatus,'installed');
  }finally{x.stop();}
});

test('self-update disposal forbids edits from the old Host after package replacement',async()=>{
  const x=setup({disposeDuringInstall:true});
  try{await flush();
    await x.click();
    assert.equal(x.calls.installed.length,1);
    const afterDispose=x.calls.writes.length;
    await flush();
    assert.equal(x.calls.writes.length,afterDispose);
  }finally{x.stop();}
});
