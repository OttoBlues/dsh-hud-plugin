import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';

const client = readFileSync(new URL('../client.js', import.meta.url), 'utf8');

function setup(valuesOverride={}, runtime={}) {
  let module;
  vm.runInNewContext(client, {
    window:{__ModuleLoader__:{load(x){module=x;}},sessionStorage:runtime.sessionStorage},
    fetch:runtime.fetch || (async()=>{throw new Error('Browser fetch unavailable');}),
    AbortSignal,AbortController,setTimeout,clearTimeout,
  });
  assert.equal(module?.id,'@local/dsh-hud');
  const hookSets=new Map(),effects=[]; let cursor=0; let currentScope='root';
  const withHooks=(key,run)=>{currentScope=key;cursor=0;return run();};
  const React={
    Fragment:'fragment',
    createElement(type,props,...children){return {type,props:props||{},children};},
    useState(initial){
      let values=hookSets.get(currentScope);
      if(!values){values=[];hookSets.set(currentScope,values);}
      const i=cursor++;
      if(!(i in values))values[i]=initial;
      return [values[i],next=>{values[i]=typeof next==='function'?next(values[i]):next;}];
    },
    useRef(initial){
      let values=hookSets.get(currentScope);
      if(!values){values=[];hookSets.set(currentScope,values);}
      const i=cursor++;
      if(!(i in values))values[i]={current:initial};
      return values[i];
    },
    useEffect(callback){effects.push(callback);},
    useSyncExternalStore(_subscribe,get){return get();},
  };
  const plugin=module.factory(name=>{assert.equal(name,'react');return React;});
  const values={
    catalog:'{"schema":3,"source":"unavailable","components":[]}',
    requestComponent:'',requestVersion:'',requestChannel:'released',
    requestNonce:'',updateStatus:'',allowUnstable:false,
    autoUpdateEnabled:false,autoUpdateUnstable:false,autoAttemptKey:'',
    overlayVisible:false,hudMode:false,
    nativeHudRequestNonce:'',nativeHudSnapshot:'',nativeHudLanguage:'zh',
    nativeHudState:'idle',nativeHudError:'',
    checkNonce:'',checkQueuedAt:'',checkState:'idle',checkError:'',checkAt:'',checkOrigin:'',
    scanAt:'',scanState:'idle',
    ...valuesOverride,
  };
  const updates=[];
  const form={
    getSnapshot(){return {value:values,writable:runtime.writable!==false,status:runtime.formStatus||'ready'};},
    subscribe(){return ()=>{};},
    async set(key,value){values[key]=value;updates.push({key,value});return true;},
    async mutate(ops){
      if(runtime.rejectPolicyWrite && ops.some(op=>['allowUnstable','autoUpdateEnabled','autoUpdateUnstable','overlayVisible'].includes(op.path[0])))return false;
      for(const op of ops){values[op.path[0]]=op.value;}updates.push({ops});return true;
    },
  };
  const slots=new Map();const navigations=[];const rpcCalls=[],installCalls=[];let dictionary;
  const ctx={
    locale:{
      register(ns,dict){dictionary=dict;assert.equal(ns,'dsh.hud');return ()=>{};},
      bind(ns){assert.equal(ns,'dsh.hud');return k=>dictionary.zh[k];},
    },
    effect(setup){setup();},
    layout:{selectPanel(id){navigations.push(id);}},
    connection:{rpc:{async call(channel,endpoint,payload,signal){
      rpcCalls.push({channel,endpoint,payload,signal});
      if(runtime.nativeRpc)return runtime.nativeRpc({channel,endpoint,payload,signal});
      if(endpoint==='hud-native.status')return {ok:true,value:{hostVersion:'0.5.14'}};
      if(endpoint==='hud-native.prepare-install')return {ok:true,value:{
        name:payload.name,version:payload.version,channel:payload.channel,
        sha256:'f'.repeat(64),path:'/fixture/cache/'+payload.version+'/verified.tgz',
      }};
      return {ok:true,value:{state:'open'}};
    }}},
    configForms:{get(key){assert.equal(key,'dsh-hud');return form;}},
    slots:{
      inject(_seat,fn){fn();},
      register(options,component){
        slots.set(options.name,{options,component});
        return ()=>{};
      },
    },
    remote:{pluginManager:{
      async listBundles(){return {ok:true,value:[]};},
      async installBundle(path,options){
        installCalls.push({path,options});
        const version=/\/(\d+\.\d+\.\d+)\//.exec(path)?.[1]||'0.5.14';
        return runtime.installResult||{ok:true,value:{application:'applied',version}};
      },
    }},
  };
  plugin.apply(ctx);
  const render=(slot='main')=>{
    const entry=slots.get(slot);
    if(!entry) throw new Error('Unknown slot '+slot);
    const props={t:k=>dictionary.zh[k]};
    if(slot==='shell.overlay'){
      props.useSessions=f=>f(runtime.sessions || {ids:[],byId:{}});
      props.useSessionStatus=f=>f(runtime.statuses || new Map());
    }
    return withHooks(slot,()=>entry.component(props));
  };
  return {plugin,values,form,slots,render,updates,navigations,rpcCalls,installCalls,withHooks,effects};
}
function find(tree,when,result=[]) {
  if(tree==null)return result;
  if(Array.isArray(tree)){for(const part of tree)find(part,when,result);}
  else if(typeof tree==='object'){
    if(when(tree))result.push(tree);
    find(tree.children,when,result);
  }
  return result;
}
const released=(v,channel='released')=>({
  channel,version:v,sha256:'f'.repeat(64),commit:'a'.repeat(40),
  file:'v'+v+'/local-dsh-hud-'+v+'.tgz',
});
const catalog=(components,source='public')=>JSON.stringify({
  schema:3,source,components,
});
const own=(releasedVersion='0.4.2',experimental=null)=>({
  id:'hud',name:'@local/dsh-hud',title:'DSH HUD',
  description:'HUD with component center',
  released:releasedVersion?released(releasedVersion):null,
  unstable:experimental?released(experimental,'unstable'):null,
});

test('HUD uses its own sidebar icon and keyed main panel, never DSH Plugins tabs',()=>{
  const ui=setup();
  assert.deepEqual(Array.from(ui.plugin.inject),
    ['slots','connection','locale','layout','uiSession','configForms','remote','remote.pluginManager']);
  assert.equal(ui.slots.get('sidebar.panellist').options.id,'dsh-hud');
  assert.equal(ui.slots.get('sidebar.panellist').options.label(),'HUD');
  assert.equal(ui.slots.get('main').options.key,'dsh-hud');
  assert.equal(ui.slots.has('plugins.tab'),false);
  const icon=ui.slots.get('sidebar.panellist').component({size:20,active:true});
  assert.equal(icon.type,'svg');
  const main=ui.render();
  assert.equal(main.type,'main');
  assert.equal(main.props['data-dsh-hud-main'],true);
});

test('components page distinguishes the repository component from DSH Plugins',()=>{
  const ui=setup({catalog:catalog([own('0.5.15')])});
  const tree=ui.render();
  assert.match(JSON.stringify(tree),/仓库组件/);
  assert.match(JSON.stringify(tree),/DSH HUD/);
  assert.match(JSON.stringify(tree),/当前/);
  assert.ok(find(tree,x=>x.type==='button'&&x.children.includes('更新')).length===1);
});

test('repository catalog lists uninstalled components and offers install',()=>{
  const ui=setup({catalog:catalog([own(null),{
    id:'companion',name:'@local/companion',title:'Companion',
    description:'Another component',released:released('1.2.0'),unstable:null,
  }])});
  const tree=ui.render();
  assert.match(JSON.stringify(tree),/Companion/);
  assert.ok(find(tree,x=>x.type==='button'&&x.children.includes('安装')).length===1);
});

test('Experimental opt-in and all automatic settings default off',()=>{
  const ui=setup({catalog:catalog([own('0.4.1','0.6.0')])});
  const tree=ui.render();
  for(const flag of ['unstable','auto','auto-unstable']){
    const node=find(tree,x=>x.type==='input'&&x.props['data-hud-setting']===flag)[0];
    assert.ok(node,flag);
    assert.equal(node.props.checked,false);
    if(flag==='auto-unstable')assert.equal(node.props.disabled,true);
  }
  assert.doesNotMatch(JSON.stringify(tree),/试验版: 0\.6\.0/);
});

test('Experimental update requires explicit toggle and a direct, verified DSH installation',async()=>{
  const ui=setup({catalog:catalog([own('0.4.1','0.6.0')])});
  const flag=find(ui.render(),x=>x.type==='input'&&x.props['data-hud-setting']==='unstable')[0];
  flag.props.onChange({target:{checked:true}});
  await Promise.resolve();
  assert.equal(ui.values.allowUnstable,true);
  const first=ui.render();
  assert.match(JSON.stringify(first),/试验版: 0\.6\.0/);
  find(first,x=>x.type==='button'&&x.children.includes('更新'))[0].props.onClick();
  const confirm=find(ui.render(),x=>x.type==='button'&&x.children.includes('确认'))[0];
  assert.ok(confirm);
  confirm.props.onClick();
  await flushMode();
  assert.equal(ui.rpcCalls.filter(x=>x.endpoint==='hud-native.prepare-install').length,1);
  assert.equal(ui.installCalls.length,1);
  assert.equal(ui.installCalls[0].options.saveExact,true);
  assert.equal(ui.installCalls[0].options.enabled,true);
  assert.equal(ui.values.requestNonce,'','No Loader install nonce is queued');
  assert.equal(ui.values.updateStatus,'','No Host status write occurs before installation');
  assert.equal(ui.updates.filter(x=>x.ops?.some(y=>y.path[0]==='updateStatus')).length,0);
});

test('Automatic experimental updates require separate explicit double opt-in',async()=>{
  const ui=setup();
  let tree=ui.render();
  const auto=find(tree,x=>x.type==='input'&&x.props['data-hud-setting']==='auto')[0];
  auto.props.onChange({target:{checked:true}});
  await flushMode();
  tree=ui.render();
  assert.equal(find(tree,x=>x.props?.['data-hud-setting']==='auto-unstable')[0].props.disabled,true);
  const experimental=find(tree,x=>x.props?.['data-hud-setting']==='unstable')[0];
  experimental.props.onChange({target:{checked:true}});
  await flushMode();
  tree=ui.render();
  const autoUnstable=find(tree,x=>x.props?.['data-hud-setting']==='auto-unstable')[0];
  assert.equal(autoUnstable.props.disabled,false);
  autoUnstable.props.onChange({target:{checked:true}});
  await flushMode();
  assert.equal(ui.values.autoUpdateUnstable,true);
  experimental.props.onChange({target:{checked:false}});
  await flushMode();
  assert.equal(ui.values.autoUpdateUnstable,false);
});

test('overlay preview remains off and does not intercept mouse events',()=>{
  const ui=setup();
  const base=ui.render('shell.overlay');
  assert.equal(base,null,'Native DSH must not show a floating HUD launcher');
  assert.equal(find(base,x=>x.props?.['data-dsh-hud-preview']===true).length,0);
  ui.values.overlayVisible=true;
  const overlay=ui.render('shell.overlay');
  const preview=find(overlay,x=>x.props?.['data-dsh-hud-preview']==='true')[0];
  assert.ok(preview);
  assert.equal(preview.props.style.pointerEvents,'none');
  assert.equal(preview.props['data-dsh-hud-version'],'0.5.14');
});

test('component center shows the renamed repository rather than legacy UI copy',()=>{
  const ui=setup();
  const rendered=JSON.stringify(ui.render());
  assert.match(rendered,/OttoBlues\/dsh-hud-plugin/);
  assert.doesNotMatch(rendered,/OttoBlues\/dsh-plugins/);
});

// React runs the functional component after our shallow mocked element.
function renderWorkspace(ui) {
  const entry=ui.render('shell.overlay');
  assert.equal(typeof entry.type,'function');
  return ui.withHooks('HudWorkspace',()=>entry.type(entry.props));
}
const flushMode=async()=>{await new Promise(resolve=>setImmediate(resolve));};

test('Component Center launches through authenticated RPC and never uses ConfigForms',async()=>{
  let complete;
  const ui=setup({},{
    sessions:{ids:['secret-1'],byId:{'secret-1':{displayTitle:'A real task'}}},
    statuses:new Map([['secret-1',{running:true}]]),
    nativeRpc:()=>new Promise(resolve=>{complete=resolve;}),
  });
  assert.equal(ui.values.hudMode,false);
  assert.equal(ui.render('shell.overlay'),null);
  const button=find(ui.render('main'),x=>x.props?.['data-hud-enter-mode']===true)[0];
  button.props.onClick();
  await flushMode();
  assert.equal(ui.rpcCalls.length,1);
  assert.equal(ui.rpcCalls[0].channel,'/api');
  assert.equal(ui.rpcCalls[0].endpoint,'hud-native.open');
  assert.equal(ui.updates.length,0,'Launch is not a config update or a Loader nonce');
  assert.equal(ui.navigations.length,0,'Never switch the DSH panel before native READY');
  const snapshot=JSON.parse(ui.rpcCalls[0].payload.snapshot);
  assert.equal(snapshot.sessions[0].title,'A real task');
  assert.equal(snapshot.sessions[0].running,true);
  assert.equal(JSON.stringify(snapshot).includes('secret-1'),false);
  assert.equal(find(ui.render('main'),x=>x.props?.['data-hud-enter-mode']===true)[0].props.disabled,true);
  complete({ok:true,value:{state:'open'}});
  await flushMode();
  assert.equal(ui.navigations.at(-1),null);
  assert.equal(find(ui.render('main'),x=>x.props?.['data-hud-enter-mode']===true)[0].props.disabled,false);
});

test('Native startup failure gives actual diagnostic and allows another try',async()=>{
  const ui=setup({},{
    nativeRpc:async()=>({ok:false,error:{
      code:'hud/native-start-failed',message:'Unable to identify DSH Desktop window',
    }}),
  });
  find(ui.render('main'),x=>x.props?.['data-hud-enter-mode']===true)[0].props.onClick();
  await flushMode();
  const tree=ui.render('main');
  assert.equal(ui.updates.length,0);
  assert.equal(ui.navigations.length,0);
  assert.match(JSON.stringify(find(tree,x=>x.props?.['data-hud-native-error']===true)),
    /Unable to identify DSH Desktop window/);
  assert.equal(find(tree,x=>x.props?.['data-hud-enter-mode']===true)[0].props.disabled,false);
});
test('HUD exits safely to native DSH conversation without resetting Session',async()=>{
  const ui=setup({hudMode:true});
  const screen=renderWorkspace(ui);
  const exit=find(screen,x=>x.props?.['data-hud-exit']===true)[0];
  assert.ok(exit);
  exit.props.onClick();
  await flushMode();
  assert.equal(ui.values.hudMode,false);
  assert.equal(ui.navigations.at(-1),null);
  assert.equal(ui.render('shell.overlay'),null);
  assert.ok(find(ui.render('main'),x=>x.props?.['data-hud-enter-mode']===true).length===1);
});

test('HUD component center navigates to its registered main panel',async()=>{
  const ui=setup({hudMode:true});
  const screen=renderWorkspace(ui);
  const manager=find(screen,x=>x.props?.['data-hud-nav']==='components')[0];
  manager.props.onClick();
  await flushMode();
  assert.equal(ui.values.hudMode,false);
  assert.equal(ui.navigations.at(-1),'dsh-hud');
});

test('HUD renders real session titles and running statuses without fabricating metrics',()=>{
  const ui=setup({hudMode:true},{
    sessions:{ids:['s1','s2'],byId:{
      s1:{displayTitle:'真实项目会话',retainedBy:{mainView:1}},
      s2:{displayTitle:'Second session'}
    }},
    statuses:new Map([['s1',{running:true}],['s2',{running:false}]])
  });
  const screen=renderWorkspace(ui);
  const dump=JSON.stringify(screen);
  assert.match(dump,/真实项目会话/);
  assert.match(dump,/Second session/);
  assert.match(dump,/进行中/);
  assert.equal(find(screen,x=>x.props?.['data-hud-session-id']==='s1').length,1);
  assert.match(dump,/在 DSH 继续会话/);
});

test('HUD Escape and manager entry both keep DSH navigation usable',async()=>{
  const ui=setup({hudMode:true});
  const screen=renderWorkspace(ui);
  find(screen,x=>x.props?.['data-hud-tab']==='sessions')[0].props.onClick();
  const button=find(ui.render('main'),x=>x.props?.['data-hud-enter-mode']===true)[0];
  assert.ok(button);
  let stopped=0;
  screen.props.onKeyDown({key:'Escape',stopPropagation(){stopped++;}});
  await flushMode();
  assert.equal(stopped,1);
  assert.equal(ui.values.hudMode,false);
  assert.equal(ui.navigations.at(-1),null);
  button.props.onClick();
  await flushMode();
  assert.equal(ui.values.hudMode,false);
  assert.equal(ui.rpcCalls.length,1);
});


test('cockpit UI uses fixed-pixel nested panels with no distorted SVG rails',()=>{
  const ui=setup({hudMode:true});
  const overlay=renderWorkspace(ui);
  assert.equal(overlay.props['data-dsh-hud-version'],'0.5.14');
  assert.equal(overlay.props.style.pointerEvents,'auto');
  const panels=find(overlay,x=>x.props?.['data-hud-cockpit-panel']===true);
  assert.ok(panels.length>=4,'hero, metrics and Session modules stay separate');
  assert.ok(panels.every(x=>/12px/.test(x.props.style.clipPath)));
  assert.ok(panels.every(x=>x.props.style.background==='#6dcbd2'));
  assert.equal(overlay.props.style.backgroundColor,'#071522');
  const liners=find(overlay,x=>x.props?.['data-hud-panel-liner']===true);
  assert.equal(liners.length,panels.length);
  assert.ok(liners.every(x=>x.props.style.inset===1 &&
    /11px/.test(x.props.style.clipPath) &&
    x.props.style.background==='#142b3a' &&
    x.props.style.pointerEvents==='none'));
  assert.equal(find(overlay,x=>x.props?.['data-hud-traces']===true).length,0);
  assert.equal(find(overlay,x=>x.props?.['data-hud-scope']===true).length,0);
  assert.ok(find(overlay,x=>x.props?.['data-hud-header-rule']===true).length===1);
  assert.equal(find(overlay,x=>x.props?.['data-hud-panel-cap']===true).length,0);
});

test('component center inherits DSH colors, keeps native cards and controls',()=>{
  const ui=setup({catalog:catalog([own('0.5.3')])});
  const tree=ui.render('main');
  assert.equal(tree.props['data-hud-management-theme'],'dsh-native');
  assert.equal(tree.props.style.background,'transparent');
  assert.equal(tree.props.style.color,'inherit');
  assert.equal(tree.props.style.backgroundImage,undefined);
  assert.equal(find(tree,x=>x.props?.['data-hud-cockpit-panel']===true).length,0);
  const card=find(tree,x=>x.props?.['data-hud-component']==='@local/dsh-hud')[0];
  assert.ok(card);
  assert.equal(card.props.style.borderRadius,12);
  assert.match(card.props.style.background,/var\(--surface-secondary/);
  const panel=find(tree,x=>x.props?.['data-hud-check-panel']===true)[0];
  assert.ok(panel);
  assert.equal(panel.type,'section');
  assert.equal(panel.props.style.borderRadius,12);
  const check=find(panel,x=>x.props?.['data-hud-check-button']===true)[0];
  assert.ok(check);
  assert.equal(check.props.style.borderRadius,8);
  const toggle=find(tree,x=>x.props?.['data-hud-setting']==='unstable')[0];
  assert.ok(toggle);
  assert.equal(toggle.props.style.width,16);
});



const rootPath='https://raw.githubusercontent.com/OttoBlues/dsh-hud-plugin/main/plugins/';
const publicIndex={schema:1,components:[{
  id:'hud',name:'@local/dsh-hud',title:'DSH HUD',
  description:'Verified metadata from the fixed public source',
}]};
const stableIndex={schema:1,component:'hud',package:'@local/dsh-hud',
  channel:'released',latest:null,releases:[]};
const unstableIndex={schema:1,component:'hud',package:'@local/dsh-hud',
  channel:'unstable',latest:'0.5.13',releases:[{
    version:'0.5.13',file:'v0.5.13/local-dsh-hud-0.5.13.tgz',
    sha256:'f'.repeat(64),sourceCommit:'a'.repeat(40),
    test:{result:'success',ciRun:'123456'},
  }]};
function mockPublicFetch(options={}){
  const calls=[];
  const fetcher=async(url,request)=>{
    calls.push({url,request});
    if(!url.startsWith(rootPath))throw new Error('External origin not allowed');
    const path=url.slice(rootPath.length);
    if(options.blocked)throw new TypeError('Failed to fetch (CORS)');
    const status=options.failUnstable && path==='hud/unstable/index.json'?503:200;
    const value=path==='index.json'?publicIndex:
      path==='hud/released/index.json'?stableIndex:
      path==='hud/unstable/index.json'?unstableIndex:null;
    return {ok:status===200&&!!value,status,
      async text(){return JSON.stringify(value??{});}};
  };
  return {fetcher,calls};
}
test('Check updates reads public GitHub directly without any Host config commands',async()=>{
  const network=mockPublicFetch();
  const ui=setup({allowUnstable:true},{fetch:network.fetcher});
  const btn=find(ui.render('main'),x=>x.props?.['data-hud-check-button']===true)[0];
  btn.props.onClick();
  await flushMode();
  assert.equal(network.calls.length,3);
  assert(network.calls.every(x=>
    x.url.startsWith(rootPath) &&
    x.request.credentials==='omit' &&
    x.request.mode==='cors' &&
    x.request.redirect==='error'));
  assert.equal(ui.values.checkNonce,'','No Host check command was queued');
  assert.equal(ui.values.requestNonce,'','No install command was queued');
  assert.equal(ui.updates.length,0,'No configForm mutations of any kind');
  const checked=ui.render('main');
  const status=find(checked,x=>x.props?.['data-hud-check-state']==='success')[0];
  assert.ok(status);
  assert.match(JSON.stringify(checked),/试验版: 0\.5\.13/);
  assert.match(JSON.stringify(checked),/Verified metadata from the fixed public source/);
});
test('A broken unstable channel reports partial check and hides stale latest',async()=>{
  const network=mockPublicFetch({failUnstable:true});
  const ui=setup({allowUnstable:true},{fetch:network.fetcher});
  find(ui.render('main'),x=>x.props?.['data-hud-check-button']===true)[0].props.onClick();
  await flushMode();
  const tree=ui.render('main');
  assert.equal(find(tree,x=>x.props?.['data-hud-check-state']==='partial').length,1);
  const error=find(tree,x=>x.props?.['data-hud-check-error']===true)[0];
  assert.match(JSON.stringify(error),/HTTP 503/);
  assert.match(JSON.stringify(tree),/试验版: —/);
});
test('Browser CORS/network failure is displayed and does not lock the button',async()=>{
  const network=mockPublicFetch({blocked:true});
  const ui=setup({checkNonce:'orphaned-host',checkState:'queued'}, {fetch:network.fetcher});
  find(ui.render('main'),x=>x.props?.['data-hud-check-button']===true)[0].props.onClick();
  await flushMode();
  const tree=ui.render('main');
  assert.equal(find(tree,x=>x.props?.['data-hud-check-state']==='failed').length,1);
  const error=find(tree,x=>x.props?.['data-hud-check-error']===true)[0];
  assert.match(JSON.stringify(error),/CORS/);
  assert.equal(find(tree,x=>x.props?.['data-hud-check-button']===true)[0].props.disabled,false);
  assert.equal(ui.values.checkNonce,'orphaned-host','A stale Host request cannot be silently removed');
});
test('The old Host queue no longer disables the new read-only Check button',()=>{
  const ui=setup({checkNonce:'stale',checkState:'checking'});
  const tree=ui.render('main');
  assert.equal(find(tree,x=>x.props?.['data-hud-check-button']===true)[0].props.disabled,false);
  assert.equal(find(tree,x=>x.props?.['data-hud-check-state']==='checking').length,1);
});
test('Direct read-only Check remains usable with Host catalog unavailable',()=>{
  const ui=setup({catalog:'{"schema":3,"source":"unavailable","components":[]}'});
  assert.equal(find(ui.render('main'),x=>x.props?.['data-hud-check-button']===true)[0].props.disabled,false);
});

test('HUD entry stays exclusive to component center after DSH mode restore',()=>{
  const ui=setup({overlayVisible:false,hudMode:false});
  assert.equal(ui.render('shell.overlay'),null);
  assert.equal(find(ui.render('main'),x=>x.props?.['data-hud-enter-mode']===true).length,1);
  ui.values.overlayVisible=true;
  const preview=ui.render('shell.overlay');
  assert.equal(find(preview,x=>x.props?.['data-dsh-hud-switcher']===true).length,0);
  assert.equal(find(preview,x=>x.props?.['data-dsh-hud-preview']==='true').length,1);
});


test('two sequential manual upgrades run through DSH Manager in one Desktop session',async()=>{
  const ui=setup({allowUnstable:true,catalog:catalog([own('0.4.1','0.6.0')])});
  const install=async()=>{
    const tree=ui.render('main');
    find(tree,x=>x.type==='button'&&x.children.includes('更新'))[0].props.onClick();
    find(ui.render('main'),x=>x.type==='button'&&x.children.includes('确认'))[0].props.onClick();
    await flushMode();
  };
  await install();
  assert.equal(ui.installCalls.length,1);
  ui.values.catalog=catalog([own('0.4.1','0.6.1')]);
  await install();
  assert.equal(ui.installCalls.length,2);
  assert.equal(ui.rpcCalls.filter(x=>x.endpoint==='hud-native.prepare-install').length,2);
  assert.equal(ui.updates.length,0,'No version install state was written to Loader settings');
});

test('HTTP 405 on native launch gives Host-restart guidance instead of Windows-platform blame',async()=>{
  const ui=setup({},{
    nativeRpc:async()=>{throw new Error('transport failure for /api/hud-native.open: HTTP 405');},
  });
  find(ui.render('main'),x=>x.props?.['data-hud-enter-mode']===true)[0].props.onClick();
  await flushMode();
  const messages=find(ui.render('main'),x=>x.props?.['data-hud-native-error']===true);
  assert.equal(messages.length,1);
  assert.match(JSON.stringify(messages),/完全退出 DSH Desktop/);
  assert.match(JSON.stringify(messages),/HTTP 405/);
});

test('stale pending install never stays queued forever or silently retries',()=>{
  const bag=new Map([['dsh-hud-install-pending',JSON.stringify({
    name:'@local/dsh-hud',version:'0.6.0',startedAt:Date.now()-240_000,
    stage:'unconfirmed',
  })]]);
  const ui=setup({allowUnstable:true,catalog:catalog([own('0.4.1','0.6.0')])},{
    sessionStorage:{getItem:key=>bag.get(key)||null,
      setItem:(key,value)=>bag.set(key,value),removeItem:key=>bag.delete(key)},
  });
  const tree=ui.render('main');
  assert.equal(find(tree,x=>x.props?.['data-hud-install-stale']===true).length,1);
  const reset=find(tree,x=>x.props?.['data-hud-clear-pending']===true)[0];
  assert.ok(reset,'User must explicitly clear stale state after checking DSH Plugins');
  reset.props.onClick();
  assert.equal(bag.has('dsh-hud-install-pending'),false);
});


test('authoritative Plugin Manager failure clears pending state and allows another manual try',async()=>{
  const bag=new Map();
  const ui=setup({allowUnstable:true,catalog:catalog([own('0.4.1','0.6.0')])},{
    sessionStorage:{getItem:key=>bag.get(key)||null,
      setItem:(key,value)=>bag.set(key,value),removeItem:key=>bag.delete(key)},
    installResult:{ok:true,value:{application:'failed',error:{
      code:'already-installed',diagnostic:'Target rejected by installed bundle guard',
    }}},
  });
  find(ui.render('main'),x=>x.type==='button'&&x.children.includes('更新'))[0].props.onClick();
  find(ui.render('main'),x=>x.type==='button'&&x.children.includes('确认'))[0].props.onClick();
  await flushMode();
  assert.equal(ui.installCalls.length,1);
  assert.equal(bag.has('dsh-hud-install-pending'),false);
  assert.match(JSON.stringify(ui.render('main')),/Target rejected by installed bundle guard/);
  assert.equal(find(ui.render('main'),x=>x.props?.['data-hud-install-pending']===true).length,0);
  find(ui.render('main'),x=>x.type==='button'&&x.children.includes('更新'))[0].props.onClick();
  find(ui.render('main'),x=>x.type==='button'&&x.children.includes('确认'))[0].props.onClick();
  await flushMode();
  assert.equal(ui.installCalls.length,2,'A failed attempt may be explicitly retried');
});


test('startup GitHub status is checking, not a false private-repository warning',async()=>{
  const network=mockPublicFetch();
  const ui=setup({}, {fetch:network.fetcher});
  const tree=ui.render('main');
  const status=find(tree,x=>x.props?.['data-hud-source']==='checking')[0];
  assert.ok(status);
  assert.doesNotMatch(JSON.stringify(status),/仓库版本源暂不可匿名访问|Public.*private/i);
  const onMount=ui.effects.find(effect=>String(effect).includes('requestCheck()'));
  assert.equal(typeof onMount,'function','The component center must scan public indexes on mount');
  onMount();
  await flushMode();
  assert.equal(network.calls.length,3);
  const checked=ui.render('main');
  assert.equal(find(checked,x=>x.props?.['data-hud-source']==='public').length,1);
});

test('update strategy checkboxes save independently and experimental auto requires three opt-ins',async()=>{
  const ui=setup();
  const checked=key=>find(ui.render('main'),x=>x.props?.['data-hud-setting']===key)[0];
  assert.equal(checked('auto-unstable').props.disabled,true);
  checked('unstable').props.onChange({target:{checked:true}});
  await flushMode();
  assert.equal(ui.values.allowUnstable,true);
  assert.equal(checked('auto-unstable').props.disabled,true);
  checked('auto').props.onChange({target:{checked:true}});
  await flushMode();
  assert.equal(ui.values.autoUpdateEnabled,true);
  assert.equal(checked('auto-unstable').props.disabled,false);
  checked('auto-unstable').props.onChange({target:{checked:true}});
  await flushMode();
  assert.equal(ui.values.autoUpdateUnstable,true);
  checked('preview').props.onChange({target:{checked:true}});
  await flushMode();
  assert.equal(ui.values.overlayVisible,true);
  assert.equal(find(ui.render('main'),x=>x.props?.['data-hud-policy-error']===true).length,0);
  assert.equal(find(ui.render('main'),x=>x.props?.['data-hud-policy-saved']===true).length,1);
});

test('settings not writable must explain why checked controls cannot commit',async()=>{
  const ui=setup({},{formStatus:'unavailable',writable:false});
  const node=find(ui.render('main'),x=>x.props?.['data-hud-setting']==='unstable')[0];
  node.props.onChange({target:{checked:true}});
  await flushMode();
  assert.equal(ui.values.allowUnstable,false);
  assert.equal(ui.updates.length,0);
  const error=find(ui.render('main'),x=>x.props?.['data-hud-policy-error']===true)[0];
  assert.match(JSON.stringify(error),/unavailable/);
  assert.match(JSON.stringify(error),/writable=false/);
});

test('settings save when DSH declares them writable before status becomes ready',async()=>{
  const ui=setup({}, {formStatus:'unavailable',writable:true});
  let tree=ui.render('main');
  const health=find(tree,x=>x.props?.['data-hud-policy-health']===true)[0];
  assert.match(JSON.stringify(health),/DSH 设置可写/);
  const node=find(tree,x=>x.props?.['data-hud-setting']==='unstable')[0];
  node.props.onChange({target:{checked:true}});
  await flushMode();
  tree=ui.render('main');
  assert.equal(ui.values.allowUnstable,true);
  assert.equal(ui.updates.length,1);
  assert.equal(find(tree,x=>x.props?.['data-hud-policy-error']===true).length,0);
  assert.equal(find(tree,x=>x.props?.['data-hud-policy-saved']===true).length,1);
});

test('a rejected Host mutation reports error rather than silently resetting all toggles',async()=>{
  const ui=setup({}, {rejectPolicyWrite:true});
  const node=find(ui.render('main'),x=>x.props?.['data-hud-setting']==='auto')[0];
  node.props.onChange({target:{checked:true}});
  await flushMode();
  assert.equal(ui.values.autoUpdateEnabled,false);
  assert.equal(ui.updates.length,0);
  const errors=find(ui.render('main'),x=>x.props?.['data-hud-policy-error']===true);
  assert.equal(errors.length,1);
  assert.match(JSON.stringify(errors[0]),/mutate was not accepted/);
  assert.equal(find(ui.render('main'),x=>x.props?.['data-hud-setting']==='auto')[0].props.checked,false);
});
