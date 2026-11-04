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
  const plugin = definition.factory((name) => {
    assert.equal(name, 'react');
    return React;
  });
  return plugin;
}

test('registers the HUD preview into the supported shell.overlay slot', () => {
  const plugin = loadClientPlugin();
  assert.deepEqual(Array.from(plugin.inject), ['slots', 'locale']);
  let namespace;
  let translations;
  let slotName;
  let registration;
  let component;
  let disposed = 0;
  const ctx = {
    effect(initializer) {
      const cleanup = initializer();
      assert.equal(typeof cleanup, 'function');
    },
    locale: {
      register(name, dict) {
        namespace = name;
        translations = dict;
        return () => { disposed++; };
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
  assert.ok(translations.zh.taskTitle.includes('待办'));
  assert.equal(slotName, 'shell.overlay');
  assert.equal(registration.name, 'shell.overlay');
  assert.equal(registration.id, 'dsh-hud.preview');
  assert.equal(registration.locale, 'dsh.hud');
  const tree = component({ t: (key) => translations.en[key] });
  assert.equal(tree.type, 'div');
  assert.equal(tree.props.style.pointerEvents, 'none');
  assert.equal(tree.props.style.background, 'transparent');
  assert.equal(tree.props['data-dsh-hud-preview'], 'true');
  assert.equal(tree.children.length, 4);
  // The test is an isolated registration smoke test, not a real DSH runtime test.
});

test('Host plugin exports a valid apply function', async () => {
  const host = await import('../index.js');
  assert.equal(typeof host.apply, 'function');
  assert.equal(host.apply(), undefined);
});
