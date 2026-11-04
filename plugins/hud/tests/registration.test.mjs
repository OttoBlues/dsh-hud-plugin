import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';

const client = readFileSync(new URL('../client.js', import.meta.url), 'utf8');

function setup(valuesOverride={}) {
  let module;
  vm.runInNewContext(client, {window:{__ModuleLoader__:{load(x){module=x;}}}});
  assert.equal(module?.id,'@local/dsh-hud');
  const hooks=[]; let cursor=0;
  const React={
    Fragment:'fragment',
    createElement(type,props,...children){return {type,props:props||{},children};},
    useState(initial){
      const i=cursor++;
      if(!(i in hooks))hooks[i]=initial;
      return [hooks[i],next=>{hooks[i]=typeof next==='function'?next(hooks[i]):next;}];
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
    overlayVisible:false,
    ...valuesOverride,
  };
  const updates=[];
  const form={
    getSnapshot(){return {value:values,writable:true,status:'ready'};},
    subscribe(){return ()=>{};},
    async set(key,value){values[key]=value;updates.push({key,value});return true;},
    async mutate(ops){for(const op of ops){values[op.path[0]]=op.value;}updates.push({ops});return true;},
  };
  const slots=new Map();let dictionary;
  const ctx={
    locale:{
      register(ns,dict){dictionary=dict;assert.equal(ns,'dsh.hud');return ()=>{};},
      bind(ns){assert.equal(ns,'dsh.hud');return k=>dictionary.zh[k];},
    },
    effect(setup){setup();},
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
    cursor=0;
    const entry=slots.get(slot);
    if(!entry) throw new Error('Unknown slot '+slot);
    const props={t:k=>dictionary.zh[k]};
    if(slot==='shell.overlay'){
      props.useSessions=f=>f({ids:[],byId:{}});
      props.useSessionStatus=f=>f(new Map());
    }
    return entry.component(props);
  };
  return {plugin,values,form,slots,render,updates};
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
  const ui=setup({catalog:catalog([own('0.4.3')])});
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
  const ui=setup({catalog:catalog([own('0.4.1','0.5.0')])});
  const tree=ui.render();
  for(const flag of ['unstable','auto','auto-unstable']){
    const node=find(tree,x=>x.type==='input'&&x.props['data-hud-setting']===flag)[0];
    assert.ok(node,flag);
    assert.equal(node.props.checked,false);
    if(flag==='auto-unstable')assert.equal(node.props.disabled,true);
  }
  assert.doesNotMatch(JSON.stringify(tree),/试验版: 0\.5\.0/);
});

test('Experimental update requires explicit toggle and manual confirmation',async()=>{
  const ui=setup({catalog:catalog([own('0.4.1','0.5.0')])});
  const flag=find(ui.render(),x=>x.type==='input'&&x.props['data-hud-setting']==='unstable')[0];
  flag.props.onChange({target:{checked:true}});
  await Promise.resolve();
  assert.equal(ui.values.allowUnstable,true);
  const first=ui.render();
  assert.match(JSON.stringify(first),/试验版: 0\.5\.0/);
  const update=find(first,x=>x.type==='button'&&x.children.includes('更新'))[0];
  update.props.onClick();
  const confirmation=ui.render();
  const submit=find(confirmation,x=>x.type==='button'&&x.children.includes('确认'))[0];
  assert.ok(submit);
  submit.props.onClick();
  await Promise.resolve();
  assert.equal(ui.values.requestComponent,'@local/dsh-hud');
  assert.equal(ui.values.requestChannel,'unstable');
  assert.equal(ui.values.requestVersion,'0.5.0');
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
  assert.equal(ui.render('shell.overlay'),null);
  ui.values.overlayVisible=true;
  const overlay=ui.render('shell.overlay');
  assert.equal(overlay.props.style.pointerEvents,'none');
  assert.equal(overlay.props['data-dsh-hud-version'],'0.4.2');
});

test('component center shows the renamed repository rather than legacy UI copy',()=>{
  const ui=setup();
  const rendered=JSON.stringify(ui.render());
  assert.match(rendered,/OttoBlues\/dsh-hud-plugin/);
  assert.doesNotMatch(rendered,/OttoBlues\/dsh-plugins/);
});
