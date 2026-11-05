import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';

const client = readFileSync(new URL('../client.js', import.meta.url), 'utf8');

function setup(valuesOverride={}, runtime={}) {
  let module;
  vm.runInNewContext(client, {
    window:{__ModuleLoader__:{load(x){module=x;}}},
    fetch:runtime.fetch || (async()=>{throw new Error('Browser fetch unavailable');}),
    AbortSignal,
  });
  assert.equal(module?.id,'@local/dsh-hud');
  const hookSets=new Map(); let cursor=0; let currentScope='root';
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
    useEffect(){},
    useSyncExternalStore(_subscribe,get){return get();},
  };
  const plugin=module.factory(name=>{assert.equal(name,'react');return React;});
  const values={
    catalog:'{"schema":3,"source":"unavailable","components":[]}',
    requestComponent:'',requestVersion:'',requestChannel:'released',
    requestNonce:'',updateStatus:'',allowUnstable:false,
    autoUpdateEnabled:false,autoUpdateUnstable:false,autoAttemptKey:'',
    overlayVisible:false,hudMode:false,
    checkNonce:'',checkQueuedAt:'',checkState:'idle',checkError:'',checkAt:'',checkOrigin:'',
    scanAt:'',scanState:'idle',
    ...valuesOverride,
  };
  const updates=[];
  const form={
    getSnapshot(){return {value:values,writable:true,status:'ready'};},
    subscribe(){return ()=>{};},
    async set(key,value){values[key]=value;updates.push({key,value});return true;},
    async mutate(ops){for(const op of ops){values[op.path[0]]=op.value;}updates.push({ops});return true;},
  };
  const slots=new Map();const navigations=[];let dictionary;
  const ctx={
    locale:{
      register(ns,dict){dictionary=dict;assert.equal(ns,'dsh.hud');return ()=>{};},
      bind(ns){assert.equal(ns,'dsh.hud');return k=>dictionary.zh[k];},
    },
    effect(setup){setup();},
    layout:{selectPanel(id){navigations.push(id);}},
    configForms:{get(key){assert.equal(key,'dsh-hud');return form;}},
    slots:{
      inject(_seat,fn){fn();},
      register(options,component){
        slots.set(options.name,{options,component});
        return ()=>{};
      },
    },
    remote:{pluginManager:{async listBundles(){return {ok:true,value:[]};}}},
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
  return {plugin,values,form,slots,render,updates,navigations,withHooks};
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
    ['slots','locale','layout','uiSession','configForms','remote','remote.pluginManager']);
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
  const ui=setup({catalog:catalog([own('0.5.7')])});
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

test('Experimental update requires explicit toggle and manual confirmation',async()=>{
  const ui=setup({catalog:catalog([own('0.4.1','0.6.0')])});
  const flag=find(ui.render(),x=>x.type==='input'&&x.props['data-hud-setting']==='unstable')[0];
  flag.props.onChange({target:{checked:true}});
  await Promise.resolve();
  assert.equal(ui.values.allowUnstable,true);
  const first=ui.render();
  assert.match(JSON.stringify(first),/试验版: 0\.6\.0/);
  const update=find(first,x=>x.type==='button'&&x.children.includes('更新'))[0];
  update.props.onClick();
  const confirmation=ui.render();
  const submit=find(confirmation,x=>x.type==='button'&&x.children.includes('确认'))[0];
  assert.ok(submit);
  submit.props.onClick();
  await Promise.resolve();
  assert.equal(ui.values.requestComponent,'@local/dsh-hud');
  assert.equal(ui.values.requestChannel,'unstable');
  assert.equal(ui.values.requestVersion,'0.6.0');
  assert.match(ui.values.requestNonce,/^\d+$/);
});

test('Automatic experimental updates require separate explicit double opt-in',async()=>{
  const ui=setup();
  let tree=ui.render();
  const auto=find(tree,x=>x.type==='input'&&x.props['data-hud-setting']==='auto')[0];
  auto.props.onChange({target:{checked:true}});
  await Promise.resolve();
  tree=ui.render();
  assert.equal(find(tree,x=>x.props?.['data-hud-setting']==='auto-unstable')[0].props.disabled,true);
  const experimental=find(tree,x=>x.props?.['data-hud-setting']==='unstable')[0];
  experimental.props.onChange({target:{checked:true}});
  await Promise.resolve();
  tree=ui.render();
  const autoUnstable=find(tree,x=>x.props?.['data-hud-setting']==='auto-unstable')[0];
  assert.equal(autoUnstable.props.disabled,false);
  autoUnstable.props.onChange({target:{checked:true}});
  await Promise.resolve();
  assert.equal(ui.values.autoUpdateUnstable,true);
  experimental.props.onChange({target:{checked:false}});
  await Promise.resolve();
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
  assert.equal(preview.props['data-dsh-hud-version'],'0.5.6');
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

test('HUD opt-in switch shows an interactive full-frame workspace without losing DSH selection',async()=>{
  const ui=setup();
  assert.equal(ui.values.hudMode,false);
  const button=find(ui.render('main'),x=>x.props?.['data-hud-enter-mode']===true)[0];
  assert.ok(button,'HUD entry belongs only in Component Center');
  button.props.onClick();
  await flushMode();
  assert.equal(ui.values.hudMode,true);
  const screen=renderWorkspace(ui);
  assert.equal(screen.props['data-dsh-hud-workspace'],true);
  assert.equal(screen.props.style.pointerEvents,'auto');
  assert.equal(screen.props['aria-modal'],true);
  assert.match(JSON.stringify(screen),/返回 DSH/);
  assert.equal(ui.navigations.length,0);
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
  assert.equal(ui.values.hudMode,true);
});


test('cockpit UI uses fixed-pixel nested panels with no distorted SVG rails',()=>{
  const ui=setup({hudMode:true});
  const overlay=renderWorkspace(ui);
  assert.equal(overlay.props['data-dsh-hud-version'],'0.5.6');
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
  channel:'unstable',latest:'0.5.7',releases:[{
    version:'0.5.7',file:'v0.5.7/local-dsh-hud-0.5.7.tgz',
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
  assert.match(JSON.stringify(checked),/试验版: 0\.5\.7/);
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
  assert.equal(find(tree,x=>x.props?.['data-hud-check-state']==='idle').length,1);
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
