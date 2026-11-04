import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';

const source = readFileSync(new URL('../client.js', import.meta.url), 'utf8');

function setup(initial = {}) {
  let entry;
  vm.runInNewContext(source, {
    window: { __ModuleLoader__: { load(value) { entry = value; } } },
  });
  assert.equal(entry.id, '@local/dsh-hud');
  const hooks = [];
  let cursor = 0;
  const React = {
    createElement: (type, props, ...children) => ({ type, props: props || {}, children }),
    Fragment: 'fragment',
    useSyncExternalStore: (_subscribe, get) => get(),
    useEffect: () => undefined,
    useState: value => {
      const slot = cursor++;
      if (!(slot in hooks)) hooks[slot] = value;
      return [hooks[slot], next => { hooks[slot] = next; }];
    },
  };
  const plugin = entry.factory(name => {
    assert.equal(name, 'react');
    return React;
  });
  const value = {
    catalog: '{"schema":2,"components":[]}',
    requestChannel: 'released',
    allowUnstable: false,
    requestComponent: '',
    requestVersion: '',
    requestNonce: '',
    updateStatus: '',
    overlayVisible: false,
    ...initial,
  };
  const form = {
    getSnapshot: () => ({ status: 'ready', value, writable: true }),
    subscribe: () => () => {},
    mutate: async ops => {
      for (const op of ops) value[op.path[0]] = op.value;
      return true;
    },
    set: async (field, next) => { value[field] = next; return true; },
  };
  const records = new Map();
  const dicts = {};
  const ctx = {
    locale: {
      register: (key, vals) => {
        dicts[key] = vals;
        return () => {};
      },
      bind: key => text => dicts[key].zh[text],
    },
    effect: init => { init(); },
    configForms: { get: key => {
      assert.equal(key, 'dsh-hud');
      return form;
    } },
    slots: {
      inject: (name, fn) => { fn(); },
      register: (options, component) => {
        records.set(options.name, { options, component });
        return () => {};
      },
    },
    remote: { pluginManager: { listBundles: async () => ({ ok: true, value: [] }) } },
  };
  plugin.apply(ctx);
  return {
    plugin, records, value, form,
    render: name => {
      cursor = 0;
      const item = records.get(name);
      if (name === 'plugins.tab') return item.component({ t: ctx.locale.bind('dsh.hud') });
      if (name === 'shell.overlay') return item.component({
        t: ctx.locale.bind('dsh.hud'),
        useSessions: select => select({ ids: [], byId: {} }),
        useSessionStatus: select => select(new Map()),
      });
      throw new Error(name);
    },
  };
}
function findNodes(node, pred, found = []) {
  if (node == null) return found;
  if (Array.isArray(node)) {
    for (const child of node) findNodes(child, pred, found);
  } else if (typeof node === 'object') {
    if (pred(node)) found.push(node);
    findNodes(node.children, pred, found);
  }
  return found;
}
const catalog = version => JSON.stringify({
  schema: 2, components: [{
    name: '@local/dsh-hud', channel: 'released', version,
    commit: 'a'.repeat(40), sha256: 'f'.repeat(64),
  }],
});

test('HUD is registered as optional overlay plus Plugins Components tab', () => {
  const harness = setup();
  assert.deepEqual(Array.from(harness.plugin.inject),
    ['slots', 'locale', 'uiSession', 'configForms', 'remote', 'remote.pluginManager']);
  assert.equal(harness.records.get('plugins.tab').options.id, 'dsh-hud.components');
  assert.equal(harness.records.get('plugins.tab').options.label(), '组件');
  assert.equal(harness.records.get('shell.overlay').options.id, 'dsh-hud.preview');
  assert.equal(harness.render('shell.overlay'), null, 'preview disabled by default');
  const tab = harness.render('plugins.tab');
  assert.equal(tab.props['data-dsh-hud-components'], 'true');
});

test('new version renders a real update button on the right of its component row', () => {
  const harness = setup({ catalog: catalog('0.4.0') });
  const tab = harness.render('plugins.tab');
  const buttons = findNodes(tab, node => node.type === 'button');
  assert.ok(buttons.some(btn => btn.children.includes('↑ 更新')));
  const text = JSON.stringify(tab);
  assert.match(text, /0\.3\.1/);
  assert.match(text, /0\.4\.0/);
});

test('click requires confirmation then stores a scoped update request', async () => {
  const harness = setup({ catalog: catalog('0.4.0') });
  const initial = harness.render('plugins.tab');
  const update = findNodes(initial, node => node.type === 'button')
    .find(btn => btn.children.includes('↑ 更新'));
  update.props.onClick();
  const confirmation = harness.render('plugins.tab');
  const confirm = findNodes(confirmation, node => node.type === 'button')
    .find(btn => btn.children.includes('确认更新'));
  assert.ok(confirm);
  confirm.props.onClick();
  await Promise.resolve();
  assert.equal(harness.value.requestComponent, '@local/dsh-hud');
  assert.equal(harness.value.requestVersion, '0.4.0');
  assert.equal(harness.value.requestChannel, 'released');
  assert.match(harness.value.requestNonce, /^\d+$/);
  const queued = harness.render('plugins.tab');
  assert.match(JSON.stringify(queued), /已确认更新/);
});

test('matching versions never present an update action', () => {
  const harness = setup({ catalog: catalog('0.3.1') });
  const tab = harness.render('plugins.tab');
  assert.equal(findNodes(tab, node => node.type === 'button' &&
    node.children.includes('↑ 更新')).length, 0);
  assert.match(JSON.stringify(tab), /已是最新/);
});

test('preview may be deliberately enabled without stealing pointer events', () => {
  const harness = setup({ overlayVisible: true });
  const overlay = harness.render('shell.overlay');
  assert.equal(overlay.props.style.pointerEvents, 'none');
  assert.equal(overlay.props['data-dsh-hud-version'], '0.3.1');
  assert.equal(overlay.children.length, 4);
});


test('unstable releases are hidden unless the user opts in; stable wins ties', () => {
  const version = v => ({ name: '@local/dsh-hud', channel: v.channel, version: v.version,
    commit: 'a'.repeat(40), sha256: 'f'.repeat(64) });
  const catalog = JSON.stringify({ schema: 2, components: [
    version({channel:'released',version:'0.3.0'}),
    version({channel:'unstable',version:'0.4.0'})
  ] });
  const h = setup({catalog});
  const initial = h.render('plugins.tab');
  assert.equal(findNodes(initial, node => node.type === 'button'
    && node.children.includes('↑ 更新')).length, 0);
  h.value.allowUnstable = true;
  const opted = h.render('plugins.tab');
  assert.ok(findNodes(opted, node => node.type === 'button'
    && node.children.includes('↑ 更新')).length === 1);
  assert.match(JSON.stringify(opted), /试验版/);
});

test('experimental opt-in setting starts disabled and can be toggled', () => {
  const h = setup();
  const tab = h.render('plugins.tab');
  const toggle = findNodes(tab, node => node.type === 'input'
    && node.props['data-hud-unstable-opt-in'] === 'true')[0];
  assert.equal(toggle.props.checked, false);
  toggle.props.onChange({target:{checked:true}});
  assert.equal(h.value.allowUnstable, true);
});

test('Host exposes experimental preferences and performs only consented direct updates', () => {
  const host = readFileSync(new URL('../index.js', import.meta.url), 'utf8');
  assert.match(host, /allowUnstable: Schema\.boolean\(\)\.default\(false\)\.volatile\(\)/);
  assert.match(host, /requestChannel: Schema\.string/);
  assert.match(host, /requestNonce: Schema\.string/);
  assert.match(host, /channel === 'unstable' && config\.allowUnstable\.get\(\) !== true/);
  assert.match(host, /ctx\.pluginManager\.installBundle\(archive, \{/);
  assert.match(host, /saveExact: true/);
  assert.match(host, /ctx\.pluginManager\.listBundles\(\)/);
  assert.match(host, /createHash\('sha256'\)/);
  assert.match(host, /raw\.githubusercontent\.com\/OttoBlues\/dsh-plugins\/main\/plugins\/hud/);
  assert.doesNotMatch(host, /GITHUB_TOKEN|child_process|exec\(/);
});

