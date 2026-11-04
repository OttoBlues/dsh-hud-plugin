import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';

const source = readFileSync(new URL('../client.js', import.meta.url), 'utf8');

function loadClientPlugin() {
  let definition;
  vm.runInNewContext(source, {
    window: { __ModuleLoader__: { load(entry) { definition = entry; } } },
  }, { filename: 'client.js' });
  assert.equal(definition?.id, '@local/dsh-hud');
  const React = { createElement: (type, props, ...children) => ({ type, props, children }) };
  return definition.factory(name => {
    assert.equal(name, 'react');
    return React;
  });
}

function buildView() {
  const plugin = loadClientPlugin();
  let namespace;
  let translations;
  let slotName;
  let registration;
  let component;
  const ctx = {
    effect(initializer) {
      const cleanup = initializer();
      assert.equal(typeof cleanup, 'function');
    },
    locale: {
      register(name, dict) {
        namespace = name;
        translations = dict;
        return () => {};
      },
    },
    slots: {
      inject(name, mount) { slotName = name; mount(); },
      register(options, view) {
        registration = options;
        component = view;
        return () => {};
      },
    },
  };
  plugin.apply(ctx);
  assert.equal(namespace, 'dsh.hud');
  assert.equal(slotName, 'shell.overlay');
  assert.equal(registration.name, 'shell.overlay');
  assert.equal(registration.id, 'dsh-hud.preview');
  assert.equal(registration.locale, 'dsh.hud');
  return { plugin, translations, component };
}

const mkSession = (id, displayTitle, running = false, mainView = 0) => ({
  id, displayTitle, running, retainedBy: { mainView }, blank: false, updatedAt: 0,
});

function render(view, list, statuses = new Map(), language = 'zh') {
  return view.component({
    t: key => view.translations[language][key],
    useSessions: selector => selector(list),
    useSessionStatus: selector => selector(statuses),
  });
}

test('registers read-only HUD into shell.overlay with Session dependency', () => {
  const view = buildView();
  assert.deepEqual(Array.from(view.plugin.inject), ['slots', 'locale', 'uiSession']);
  const list = { ids: [], byId: {}, phase: 'ready', projectionsBySession: {} };
  const tree = render(view, list);
  assert.equal(tree.type, 'div');
  assert.equal(tree.props.style.pointerEvents, 'none');
  assert.equal(tree.props.style.background, 'transparent');
  assert.equal(tree.props['data-dsh-hud-preview'], 'true');
  assert.equal(tree.props['data-dsh-hud-version'], '0.2.0');
  assert.equal(tree.children.length, 4);
  assert.match(tree.children[0].props.detail, /会话 0/);
  assert.match(tree.children[3].children[0].children[0], /尚未选中会话/);
});

test('renders Session catalog, running and pending interaction snapshots', () => {
  const view = buildView();
  const list = {
    ids: ['s-1', 's-2'],
    byId: {
      's-1': mkSession('s-1', 'GPU 状态估计', true, 1),
      's-2': mkSession('s-2', 'HUD 插件研发', false, 0),
    },
    phase: 'ready',
    projectionsBySession: {},
  };
  const statuses = new Map([
    ['s-1', { running: true, pendingInteraction: { key: 'req', kind: 'other', sessionId: 's-1' }, completionUnread: false }],
    ['s-2', { running: false, pendingInteraction: undefined, completionUnread: false }],
  ]);
  const tree = render(view, list, statuses);
  assert.match(tree.children[0].props.detail, /会话 2 · 运行中 1 · 待处理 1/);
  assert.match(tree.children[3].children[0].children[0], /GPU 状态估计/);
  assert.match(tree.children[3].children[1].children[0], /执行中/);
  assert.match(tree.children[2].props.detail, /实时消息待接入/);
});

test('reactive selectors reflect changed Session status on rerender', () => {
  const view = buildView();
  const list = {
    ids: ['s-1'], byId: { 's-1': mkSession('s-1', 'Demo', false, 1) },
    phase: 'ready', projectionsBySession: {},
  };
  const before = render(view, list, new Map([['s-1', { running: false }]]), 'en');
  const after = render(view, list, new Map([['s-1', { running: true }]]), 'en');
  assert.match(before.children[0].props.detail, /Running 0/);
  assert.match(after.children[0].props.detail, /Running 1/);
});

test('counts catalog sessions, not retained subagent fallback rows', () => {
  const view = buildView();
  const list = {
    ids: ['s-1'],
    byId: { 's-1': mkSession('s-1', 'User session', false), child: mkSession('child', 'Subagent', true) },
    phase: 'ready', projectionsBySession: {},
  };
  const tree = render(view, list);
  assert.match(tree.children[0].props.detail, /会话 1 · 运行中 0/);
});

test('Host plugin exports apply', async () => {
  const host = await import('../index.js');
  assert.equal(typeof host.apply, 'function');
  assert.equal(host.apply(), undefined);
});
