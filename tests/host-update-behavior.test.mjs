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
  // Legacy pre-v0.5.9 requests can still be pending; their cached catalog is
  // supplied by the previous plugin generation. New runtime discovery no
  // longer writes Loader config just to expose metadata.
  const existingReleased=overrides.released===undefined?'0.4.1':overrides.released;
  const stored=(channel,version)=>version?{
    channel,version,file:'v'+version+'/local-dsh-hud-'+version+'.tgz',
    sha256:overrides.badChecksum?'f'.repeat(64):sha,commit,
  }:null;
  const savedCatalog=JSON.stringify({schema:3,source:'public',
    components:[{...repoIndex.components[0],
      released:stored('released',existingReleased),
      unstable:stored('unstable',overrides.unstable||null)}]});
  const values={
    catalog:savedCatalog,
    allowUnstable:false,autoUpdateEnabled:false,autoUpdateUnstable:false,
    autoAttemptKey:'',overlayVisible:false,
    nativeHudRequestNonce:'',nativeHudSnapshot:'',nativeHudLanguage:'zh',
    nativeHudState:'idle',nativeHudError:'',
    checkNonce:'',checkQueuedAt:'',checkState:'idle',checkError:'',checkAt:'',checkOrigin:'',
    scanAt:'',scanState:'idle',
    requestComponent:'',requestVersion:'',requestChannel:'released',
    requestNonce:'',updateStatus:'',
    ...overrides.values,
  };
  const calls={http:[],installed:[],list:0,writes:[],logs:[],cached:[],native:[],fetchRoutes:[]};
  const storedFiles=new Map();
  const inventory=overrides.inventory || [{name:NAME,installed:true,version:'0.4.0'}];
  const callbacks=[], startTimers=[], events=new Map(),rpcRoutes=new Map(),effectDisposers=[];
  const dispose=()=>{for(const fn of effectDisposers.splice(0).reverse())fn();};
  const editableEntry={options:{id:'dsh-hud'}};
  let editorReady=overrides.editorInitiallyAvailable!==false;
  let failCheckClaimOnce=overrides.rejectCheckClaimOnce===true;
  let clock=Date.now();
  const field=()=>({default(){return this;},volatile(){return this;}});
  const Schema={string:field,boolean:field,object:f=>f};
  const fetch=async(url,opts)=>{
    calls.http.push({url,opts});
    if(overrides.private===true)return response('Not found',404);
    if(overrides.oldNameOnly && url.includes('/dsh-hud-plugin/'))return response('Not found',404);
    if(url.endsWith('/plugins/index.json'))return response(JSON.stringify(repoIndex));
    if(url.endsWith('/hud/released/index.json'))return response(JSON.stringify(
      index('released',overrides.released===undefined?'0.4.1':overrides.released,overrides.badChecksum?'f'.repeat(64):sha)));
    if(overrides.failUnstable && url.endsWith('/hud/unstable/index.json'))return response('Not found',404);
    if(url.endsWith('/hud/unstable/index.json'))return response(JSON.stringify(
      index('unstable',overrides.unstable || null)));
    if(url.endsWith('.tgz'))return response(archive);
    return response('missing',404);
  };
  const ctx={
    root:{get(){throw new Error('HUD routes must use the Connection Fetch bridge');}},
    fiber:{entry:overrides.wrongFiberEntry?{options:{id:'not-hud'}}:editableEntry},
    get(name){
      if(name==='pluginManager')return overrides.managerUnavailable ? undefined : ctx.pluginManager;
      if(name!=='configEditor'||!editorReady)return;
      return{
        entries(){return overrides.noAddressableEntry?[]:[editableEntry];},
        async edit(entry,transform){
        if(entry!==editableEntry)throw new Error('Wrong Loader Entry object');
        const next=transform({...values});
        if(failCheckClaimOnce && next.checkState==='success' && next.checkAt){
          failCheckClaimOnce=false;
          throw new Error('Simulated transient ConfigEditor lock');
        }
        if(overrides.rejectManualConfigWrite && next.updateStatus==='installing' && next.requestNonce===''){
          throw new Error('Configuration entry is no longer available');
        }
        Object.assign(values,next);calls.writes.push(next);
      }};
    },
    logger:{warn:(...x)=>calls.logs.push(x.join(' ')),info:(...x)=>calls.logs.push(x.join(' '))},
    connection:{
      browserPeer:{principal:{kind:'owner'}},
      fetch:{register(route){
        calls.fetchRoutes.push(route.path);
        if(rpcRoutes.has(route.path))throw new Error('Duplicate route '+route.path);
        rpcRoutes.set(route.path,route);
        return ()=>rpcRoutes.delete(route.path);
      }},
    },
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
    effect:fn=>{const cleanup=fn();if(typeof cleanup==='function')effectDisposers.push(cleanup);},
    on:(name,fn)=>{events.set(name,fn);},
  };
  class TestDate extends Date {
    constructor(...args){super(...(args.length?args:[clock]));}
    static now(){return clock;}
  }
  const sandbox={
    Schema,createHash,Buffer,AbortController,AbortSignal,Request,Response,fetch,join,Date:TestDate,
    launchWindowsHud(options) {
      calls.native.push(options);
      if (overrides.nativeThrows) throw new Error('Window spawn forbidden by OS');
      return {close(){calls.nativeClosed=true;}};
    },
    homedir:()=>'/home',process:{env:{},pid:999},
    mkdir:async()=>{},readFile:async path=>{
      if(!storedFiles.has(path))throw new Error('ENOENT');
      return storedFiles.get(path);
    },
    writeFile:async(path,data)=>{calls.cached.push({path,data});storedFiles.set(path,String(data));},
    rename:async(from,to)=>{storedFiles.set(to,storedFiles.get(from));storedFiles.delete(from);},
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
  async function invoke(endpoint,payload={},signal=new AbortController().signal,
    peer={principal:{kind:'owner'}}){
    const method='hud-native.'+endpoint;
    const route=rpcRoutes.get('/api/'+method);
    assert.equal(typeof route?.fetch,'function');
    assert.equal(route.methods.length,1);
    assert.equal(route.methods[0],'POST');
    assert.equal(route.requestBody,'buffered');
    if(peer?.principal?.kind!=='owner')return{ok:false,error:{
      code:'hud/forbidden',message:'Owner access required.',
    }};
    const request=new Request('http://dsh.internal/api/'+method,{
      method:'POST',headers:{'content-type':'application/json'},signal,
      body:JSON.stringify({type:'client-request',rpcId:'fixture-rpc-id',method,payload}),
    });
    const response=await route.fetch(request);
    if(!response.ok)throw new Error('HTTP '+response.status);
    const envelope=await response.json();
    assert.equal(envelope.type,'server-response');
    assert.equal(envelope.rpcId,'fixture-rpc-id');
    return envelope.result;
  }
  return {values,calls,inventory,click,
    fetchRoute:path=>rpcRoutes.get(path),
    native:(data={snapshot:'{"sessions":[]}',language:'zh'},signal=new AbortController().signal,peer={principal:{kind:'owner'}})=>
      invoke('open',data,signal,peer),
    status:()=>invoke('status'),
    hasNativeRoute:()=>rpcRoutes.has('/api/hud-native.open')&&
      rpcRoutes.has('/api/hud-native.status')&&rpcRoutes.has('/api/hud-native.prepare-install'),
    prepare:(data,signal=new AbortController().signal,peer={principal:{kind:'owner'}})=>
      invoke('prepare-install',data,signal,peer),
    check:async()=>{values.checkNonce='check-'+(++id);values.checkState='checking';
      callbacks[1]();await flush();},
    refresh:async()=>{callbacks[0]();await flush();},
    reconcile:async()=>{startTimers[0]?.();await flush();},
    checkCallback:async()=>{callbacks[1]();await flush();},
    sendVolatile:async()=>{events.get('loader/volatile-update')?.([['checkNonce']]);await flush();},
    enableEditor:()=>{editorReady=true;},
    advance:ms=>{clock+=ms;},
    stop:()=>dispose()};
}

test('native RPC registers exact authenticated Connection API routes',async()=>{
  const s=setup();
  try{
    assert.equal(s.hasNativeRoute(),true);
    assert.deepEqual(s.calls.fetchRoutes,[
      '/api/hud-native.open','/api/hud-native.prepare-install','/api/hud-native.status',
    ]);
    assert.equal((await s.status()).value.hostVersion,'0.5.14');
  }finally{
    s.stop();
    assert.equal(s.hasNativeRoute(),false);
  }
});

test('native RPC rejects malformed envelopes before touching the window launcher',async()=>{
  const s=setup();
  try{
    const route=s.fetchRoute('/api/hud-native.open');
    const response=await route.fetch(new Request('http://dsh.internal/api/hud-native.open',{
      method:'POST',headers:{'content-type':'application/json'},body:'{}',
    }));
    assert.equal(response.status,400);
    assert.equal(s.calls.native.length,0);
  }finally{s.stop();}
});

test('public repository index exposes components with released and unstable channels',async()=>{
  const s=setup({unstable:'0.4.2'});
  try{
    await flush();
    const status=await s.status();
    assert.equal(status.value.scanState,'success');
    assert.equal(status.value.hostVersion,'0.5.14');
    assert.equal(s.calls.writes.length,0,'Background scanning must not recompose its own Host');
    assert(s.calls.http.some(x=>x.url.endsWith('/hud/released/index.json')));
    assert(s.calls.http.some(x=>x.url.endsWith('/hud/unstable/index.json')));
    assert.equal(s.calls.installed.length,0,'Discovering versions must not install');
    assert(s.calls.http.every(x=>x.opts.redirect==='error'&&x.opts.headers.authorization===undefined));
  }finally{s.stop();}
});

test('private repository is identified as unavailable, not up to date',async()=>{
  const s=setup({private:true});
  try{
    await flush();
    assert.equal((await s.status()).value.scanState,'failed');
    assert.equal(s.calls.writes.length,0);
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
    assert.equal((await overridden.status()).value.autoState,'failed');
    assert.equal(overridden.values.updateStatus,'installing','Old Loader state is no longer an authoritative result');
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
    assert.equal(s.values.updateStatus,'');
    assert.equal(s.values.autoAttemptKey,'','No pre-install ConfigEditor changes');
    assert(s.calls.cached.some(x=>x.path.includes('.auto-attempt.json')));
    assert.equal((await s.status()).value.autoState,'restart-required');
    await s.refresh();
    assert.equal(s.calls.installed.length,1);
  }finally{s.stop();}
});

test('experimental versions never auto install unless both additional switches enabled',async()=>{
  const s=setup({unstable:'0.4.2',values:{autoUpdateEnabled:true,allowUnstable:true}});
  try{await flush();
    assert.equal(s.calls.installed.length,1);
    assert.equal(s.values.autoAttemptKey,'');
    assert(s.calls.cached.some(x=>String(x.data).includes('released:0.4.1:')));
  }finally{s.stop();}
  const exp=setup({unstable:'0.4.2',values:{
    autoUpdateEnabled:true,allowUnstable:true,autoUpdateUnstable:true,
  }});
  try{await flush();
    assert.equal(exp.calls.installed.length,1);
    assert.equal(exp.values.autoAttemptKey,'');
    assert(exp.calls.cached.some(x=>String(x.data).includes('unstable:0.4.2:')));
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


test('manual refresh fetches both channels immediately and records success',async()=>{
  const s=setup({unstable:'0.5.1'});
  try {
    await flush();
    const before=s.calls.http.length;
    await s.check();
    assert(s.calls.http.length>before,'Manual check should fetch all sources again');
    assert.equal(s.values.checkState,'success');
    assert.match(s.values.checkAt,/^\d{4}-\d{2}-\d{2}T/);
    assert.equal(s.values.checkOrigin,'canonical');
    assert.equal(s.values.checkNonce,'');
    assert.equal(s.calls.installed.length,0);
  } finally{s.stop();}
});

test('manual refresh exposes missing unstable channel instead of a fake latest',async()=>{
  const s=setup({failUnstable:true});
  try {
    await flush();
    await s.check();
    assert.equal(s.values.checkState,'partial');
    assert.match(s.values.checkError,/hud\/unstable/);
    const rows=JSON.parse(s.values.catalog);
    assert.equal(rows.source,'public');
    assert.equal(rows.components[0].unstable,null);
    assert.equal(s.calls.installed.length,0);
  } finally{s.stop();}
});

test('manual refresh surfaces network failure and does not install',async()=>{
  const s=setup({private:true});
  try {
    await flush();
    await s.check();
    assert.equal(s.values.checkState,'failed');
    assert(s.values.checkError.length>0);
    assert.equal(JSON.parse(s.values.catalog).source,'unavailable');
    assert.equal(s.calls.installed.length,0);
  } finally{s.stop();}
});

test('explicit check never triggers a package replacement even if auto-update is enabled',async()=>{
  const s=setup();
  try {
    await flush(); // complete initial periodic discovery first
    s.values.autoUpdateEnabled=true;
    await s.check();
    assert.equal(s.values.checkState,'success');
    assert.equal(s.calls.installed.length,0);
  } finally{s.stop();}
});


test('a timed-out previous nonce is not replayed after a successful manual check',async()=>{
  const s=setup({unstable:'0.5.3'});
  try{
    await flush();
    await s.check();
    assert.equal(s.values.checkState,'success');
    const count=s.calls.http.length;
    // The manual callback can fire again; consumed nonce must not re-fetch.
    await s.refresh();
    assert(s.calls.http.length>count,'Periodic scan must still work');
    assert.equal((await s.status()).value.scanState,'success');
    assert.match((await s.status()).value.scanAt,/^\d{4}-\d{2}-\d{2}T/);
    assert.equal(s.values.checkNonce,'');
  }finally{s.stop();}
});

test('a failed channel never becomes a false successful background scan',async()=>{
  const s=setup({failUnstable:true});
  try{
    await flush();
    assert.equal((await s.status()).value.scanState,'partial');
    await s.check();
    assert.equal(s.values.checkState,'partial');
  }finally{s.stop();}
});


test('a failed ConfigEditor result commit does not permanently consume the request nonce',async()=>{
  const s=setup({rejectCheckClaimOnce:true});
  try{
    await flush(); // initial catalog discovery with a working editor
    const initialHttp=s.calls.http.length;
    s.values.checkNonce='retry-nonce';
    s.values.checkState='queued';
    await s.checkCallback();
    assert.equal(s.values.checkNonce,'retry-nonce');
    assert.equal(s.values.checkState,'queued','Host could not publish its result');
    assert(s.calls.logs.some(x=>/Simulated transient ConfigEditor lock/.test(x)));
    // One 3-second retry backoff, then the SAME nonce must resume.
    s.advance(3_100);
    await s.checkCallback();
    assert.equal(s.values.checkNonce,'');
    assert.equal(s.values.checkState,'success');
    assert(s.calls.http.length>initialHttp,'A failed result write must allow another GitHub scan');
  }finally{s.stop();}
});

test('a ConfigEditor that loads after the HUD Host starts can process pending updates',async()=>{
  const s=setup({editorInitiallyAvailable:false});
  try{
    await flush();
    assert.equal((await s.status()).value.scanState,'success',
      'Read-only Host discovery must not depend on ConfigEditor availability');
    s.values.checkNonce='pending-before-service';
    s.values.checkState='queued';
    await s.checkCallback();
    assert.equal(s.values.checkState,'queued');
    assert(s.calls.logs.some(x=>/ConfigEditor or profile-editable dsh-hud entry unavailable/.test(x)));
    s.enableEditor();
    s.advance(3_100);
    await s.checkCallback();
    assert.equal(s.values.checkState,'success');
    assert.equal(s.values.checkNonce,'');
    assert.equal(JSON.parse(s.values.catalog).source,'public');
  }finally{s.stop();}
});

test('manual scan completion is not reported when its catalog/status edit fails',async()=>{
  const s=setup({rejectCheckClaimOnce:true});
  try{
    await flush();
    s.values.checkNonce='result-must-be-real';
    s.values.checkState='queued';
    await s.checkCallback();
    assert.notEqual(s.values.checkState,'success');
    assert.equal(s.values.checkNonce,'result-must-be-real');
    s.advance(3_100);
    await s.checkCallback();
    assert.equal(s.values.checkState,'success');
  }finally{s.stop();}
});


test('Host uses DSH ConfigEditor addressable entry rather than an unrelated fiber shortcut',async()=>{
  const s=setup({wrongFiberEntry:true});
  try{
    await flush();
    assert.equal(JSON.parse(s.values.catalog).source,'public');
    s.values.checkNonce='from-native-settings';
    s.values.checkState='queued';
    await s.sendVolatile();
    assert.equal(s.values.checkNonce,'');
    assert.equal(s.values.checkState,'success');
    assert(s.calls.logs.some(x=>/HUD Host received manual check request/.test(x)));
    assert.equal(s.calls.installed.length,0);
  }finally{s.stop();}
});

test('missing profile-editable entry does not falsely consume a manual check',async()=>{
  const s=setup({noAddressableEntry:true});
  try{
    await flush();
    s.values.checkNonce='still-pending';
    s.values.checkState='queued';
    await s.sendVolatile();
    assert.equal(s.values.checkNonce,'still-pending');
    assert.equal(s.values.checkState,'queued');
    assert(s.calls.logs.some(x=>/profile-editable dsh-hud entry unavailable/.test(x)));
    assert.equal(s.calls.installed.length,0);
  }finally{s.stop();}
});

test('immediate volatile-update callback handles checks without a timer tick',async()=>{
  const s=setup();
  try{
    await flush();
    const before=s.calls.http.length;
    s.values.checkNonce='volatile-event';
    s.values.checkState='queued';
    await s.sendVolatile(); // never calls the 850 ms scheduled callback
    assert(s.calls.http.length>before);
    assert.equal(s.values.checkState,'success');
    assert.equal(s.values.checkNonce,'');
    assert.equal(s.calls.installed.length,0);
  }finally{s.stop();}
});

test('native HUD RPC reports READY without a Host ConfigEditor write',async()=>{
  const s=setup();
  try {
    const promise=s.native();
    await flush();
    assert.equal(s.calls.native.length,1);
    assert.equal(s.calls.writes.filter(x=>x.nativeHudState).length,0);
    s.calls.native[0].onReady();
    const opened=await promise;
    assert.equal(opened.ok,true);
    assert.equal(opened.value.state,'open');
    s.calls.native[0].onExit({ready:true,error:''});
    const next=s.native();
    await flush();
    assert.equal(s.calls.native.length,2,'Closing native window allows another launch');
    s.calls.native[1].onReady();
    await next;
  }finally{s.stop();}
});

test('native HUD RPC propagates exact process-start failure to the Client',async()=>{
  const s=setup({nativeThrows:true});
  try {
    const result=await s.native();
    assert.equal(result.ok,false);
    assert.equal(result.error.code,'hud/native-unavailable');
    assert.match(result.error.message,/Window spawn forbidden by OS/);
    assert.equal(s.calls.writes.filter(x=>x.nativeHudState).length,0);
  }finally{s.stop();}
});

test('native HUD RPC cancels pending launch and restores shell on transport abort',async()=>{
  const s=setup();
  try {
    const abort=new AbortController();
    const outcome=s.native(undefined,abort.signal);
    await flush();
    assert.equal(s.calls.native.length,1);
    abort.abort();
    const result=await outcome;
    assert.equal(result.ok,false);
    assert.equal(result.error.code,'hud/cancelled');
    assert.equal(s.calls.nativeClosed,true);
  }finally{s.stop();}
});

test('native HUD RPC disallows non-owner and duplicate windows',async()=>{
  const s=setup();
  try {
    const blocked=await s.native(undefined,new AbortController().signal,
      {principal:{kind:'guest'}});
    assert.equal(blocked.error.code,'hud/forbidden');
    assert.equal(s.calls.native.length,0);
    const opening=s.native();
    await flush();
    assert.equal(s.calls.native.length,1);
    const duplicate=await s.native();
    assert.equal(duplicate.error.code,'hud/already-open');
    s.calls.native[0].onReady();
    await opening;
  }finally{s.stop();}
});


test('authenticated prepare-install verifies bytes before returning a local immutable path',async()=>{
  const s=setup();
  try {
    await flush();
    const result=await s.prepare({id:'hud',name:NAME,version:'0.4.1',channel:'released'});
    assert.equal(result.ok,true);
    assert.equal(result.value.version,'0.4.1');
    assert.equal(result.value.sha256,sha);
    assert.match(result.value.path,/approved-component-packages/);
    assert(s.calls.cached.some(x=>x.path.includes('0.4.1')));
    assert.equal(s.calls.installed.length,0,'Preparation must never start an installation');
    assert.equal(s.calls.writes.length,0,'Preparation cannot edit Loader profile');
  } finally{s.stop();}
});

test('prepare-install rejects altered SHA and non-owner callers',async()=>{
  const s=setup({badChecksum:true});
  try {
    await flush();
    const denied=await s.prepare({id:'hud',name:NAME,version:'0.4.1',channel:'released'},
      new AbortController().signal,{principal:{kind:'guest'}});
    assert.equal(denied.ok,false);
    assert.equal(denied.error.code,'hud/forbidden');
    const changed=await s.prepare({id:'hud',name:NAME,version:'0.4.1',channel:'released'});
    assert.equal(changed.ok,false);
    assert.equal(changed.error.code,'hud/prepare-failed');
    assert.match(changed.error.message,/SHA-256 mismatch/);
    assert.equal(s.calls.installed.length,0);
  } finally{s.stop();}
});

test('legacy pending nonce is not replayed on reloaded Host and does not disturb new RPC',async()=>{
  const s=setup({values:{requestNonce:'old-confirmation',updateStatus:'queued'}});
  try {
    await flush();
    await s.checkCallback();
    assert.equal(s.calls.installed.length,0,'Recomposed Host must not replay old confirmation');
    assert.equal((await s.status()).value.hostVersion,'0.5.14');
  } finally{s.stop();}
});

test('background automatic update uses no pre-install ConfigEditor and does not retry the same SHA',async()=>{
  const s=setup({values:{autoUpdateEnabled:true}});
  try {
    await flush();
    assert.equal(s.calls.installed.length,1);
    assert.equal(s.calls.writes.length,0);
    assert(s.calls.cached.some(x=>x.path.includes('.auto-attempt.json')));
    await s.refresh();
    assert.equal(s.calls.installed.length,1);
  } finally{s.stop();}
});


test('Host exposes native status RPC when optional Plugin Manager has not started',async()=>{
  const s=setup({managerUnavailable:true});
  try {
    const status=await s.status();
    assert.equal(status.ok,true);
    assert.equal(status.value.hostVersion,'0.5.14');
    assert.equal(s.calls.installed.length,0);
    const pending=s.native();
    await flush();
    assert.equal(s.calls.native.length,1,'Independent HUD RPC must not depend on pluginManager');
    s.calls.native[0].onReady();
    const started=await pending;
    assert.equal(started.ok,true);
  } finally {s.stop();}
});
