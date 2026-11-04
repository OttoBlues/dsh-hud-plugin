import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { setImmediate as nextTick } from 'node:timers/promises';
import vm from 'node:vm';

const hostSource = readFileSync(new URL('../plugins/hud/index.js', import.meta.url), 'utf8')
  .replace(/^import .+;\r?\n/gm, '')
  .replace(/^export const /gm, 'const ')
  .replace(/^export function /gm, 'function ');
const PACKAGE = '@local/dsh-hud';
const testArchive = Buffer.from('mock installer archive for checksum tests; DSH manager is mocked');
const hash = createHash('sha256').update(testArchive).digest('hex');
const commit = 'a'.repeat(40);
const regular = (channel, version = '0.4.0', checksum = hash) => ({
  schema: 1,
  channel,
  component: 'hud',
  package: PACKAGE,
  latest: version,
  releases: [{
    version, sha256: checksum, sourceCommit: commit,
    file: 'v' + version + '/local-dsh-hud-' + version + '.tgz',
    ...(channel === 'released' ?
      { acceptance: { check: 'U88', decision: 'approved', date: '2026-11-04' } } :
      { test: { ciRun: '123456789', result: 'success' } }),
  }],
});
const empty = channel => ({
  schema: 1, channel, component: 'hud', package: PACKAGE, latest: null, releases: [],
});
function reply(body, status = 200) {
  const data = typeof body === 'string' ? Buffer.from(body) : body;
  return {
    ok: status === 200, status,
    headers: { get: name => name === 'content-length' ? String(data.length) : null },
    body: {
      getReader() {
        let used = false;
        return {
          async read() {
            if (used) return { done: true };
            used = true;
            return { done: false, value: data };
          },
          async cancel() {},
        };
      },
    },
  };
}
async function drain() {
  for (let i = 0; i < 8; i++) await nextTick();
}
function harness(options = {}) {
  const values = {
    catalog: '{"schema":2,"components":[]}',
    requestComponent: '',
    requestVersion: '',
    requestChannel: 'released',
    requestNonce: '',
    allowUnstable: false,
    overlayVisible: false,
    updateStatus: '',
  };
  const calls = { fetch: [], installs: [], listed: 0, files: [], writes: [], warnings: [] };
  const callbacks = [];
  let disposed;
  const schemaField = () => ({ default() { return this; }, volatile() { return this; } });
  const schema = {
    object(fields) { return fields; },
    string: schemaField,
    boolean: schemaField,
  };
  const stable = options.stable === false ? null : regular('released', options.version || '0.4.0', options.checksum || hash);
  const experimental = options.experimental ? regular('unstable', options.version || '0.4.0') : empty('unstable');
  const fetch = async (url, init) => {
    calls.fetch.push({ url, init });
    if (options.private) return reply('No public access', 404);
    if (url.endsWith('/released/index.json')) return reply(JSON.stringify(stable || empty('released')));
    if (url.endsWith('/unstable/index.json')) return reply(JSON.stringify(experimental));
    if (url.endsWith('.tgz')) return reply(testArchive);
    return reply('Missing', 404);
  };
  const ctx = {
    fiber: { entry: { id: 'dsh-hud' } },
    get(name) {
      if (name !== 'configEditor') return undefined;
      return {
        async edit(_entry, change) {
          const next = change({ ...values });
          calls.writes.push(next);
          Object.assign(values, next);
        },
      };
    },
    logger: { warn: (...values) => { calls.warnings.push(values.join(' ')); } },
    pluginManager: {
      async installBundle(path, settings) {
        calls.installs.push({ path, settings });
        return {
          application: options.application || 'restart-required',
          bundle: PACKAGE, version: options.reportVersion || (options.version || '0.4.0'),
        };
      },
      async listBundles() {
        calls.listed++;
        return [{
          name: PACKAGE, installed: true,
          version: options.installedVersion || (options.version || '0.4.0'),
        }];
      },
    },
    effect(setup) { disposed = setup(); },
  };
  const sandbox = {
    Schema: schema, Buffer, AbortController, AbortSignal, createHash, join,
    tmpdir: () => '/tmp',
    mkdtemp: async () => '/tmp/dsh-update-mock',
    writeFile: async (path, content) => { calls.files.push({ path, content }); },
    rm: async () => {},
    fetch,
    setInterval(callback) { callbacks.push(callback); return callbacks.length; },
    clearInterval() {},
    console,
  };
  vm.runInNewContext(hostSource + '\n;globalThis.__testHost = {apply};', sandbox);
  const config = Object.fromEntries(Object.keys(values).map(key => [
    key, { get: () => values[key] },
  ]));
  sandbox.__testHost.apply(ctx, config);
  assert.equal(callbacks.length, 2);
  let sequence = 0;
  const update = async (channel = 'released', version = '0.4.0') => {
    values.requestComponent = PACKAGE;
    values.requestVersion = version;
    values.requestChannel = channel;
    values.requestNonce = 'explicit-confirmation-' + channel + '-' + (++sequence);
    callbacks[1]();
    await drain();
  };
  return { values, calls, update, async refresh() { callbacks[0](); await drain(); }, stop() { disposed(); } };
}

test('public approved release is discoverable without sending credentials', async () => {
  const h = harness();
  try {
    await drain();
    assert.deepEqual(JSON.parse(h.values.catalog).components.map(x => x.channel), ['released']);
    assert.equal(h.calls.installs.length, 0, 'Discovery must never install automatically');
    for (const call of h.calls.fetch) {
      assert.equal(call.init.redirect, 'error');
      assert.equal(call.init.headers.authorization, undefined);
      assert.ok(call.init.signal);
    }
  } finally { h.stop(); }
});

test('private or missing releases are not advertised as working updates', async () => {
  const h = harness({ private: true });
  try {
    await drain();
    assert.deepEqual(JSON.parse(h.values.catalog).components, []);
    assert.equal(h.calls.installs.length, 0);
  } finally { h.stop(); }
});

test('click confirmation is consumed before install and never replays on a second check', async () => {
  const h = harness();
  try {
    await drain();
    await h.update();
    assert.equal(h.calls.installs.length, 1);
    assert.equal(h.calls.installs[0].settings.saveExact, true);
    assert.equal(h.values.requestNonce, '', 'Request must be consumed before installation');
    assert.equal(h.values.updateStatus, 'restart-required');
    assert.equal(h.calls.listed, 1);
    assert.equal(h.calls.files.length, 1);
    await h.refresh();
    assert.equal(h.calls.installs.length, 1, 'Update must not replay after check/restart');
  } finally { h.stop(); }
});

test('tampered tgz fails SHA256 validation before DSH sees a package', async () => {
  const h = harness({ checksum: 'f'.repeat(64) });
  try {
    await drain();
    await h.update();
    assert.equal(h.calls.installs.length, 0);
    assert.equal(h.values.updateStatus, 'failed');
    assert.equal(h.values.requestNonce, '');
  } finally { h.stop(); }
});

test('overridden install is not falsely reported as successful', async () => {
  const h = harness({ application: 'overridden' });
  try {
    await drain();
    await h.update();
    assert.equal(h.calls.installs.length, 1);
    assert.equal(h.calls.listed, 0);
    assert.equal(h.values.updateStatus, 'failed');
  } finally { h.stop(); }
});

test('installed version mismatch fails post-install verification', async () => {
  const h = harness({ installedVersion: '0.3.1' });
  try {
    await drain();
    await h.update();
    assert.equal(h.calls.installs.length, 1);
    assert.equal(h.calls.listed, 1);
    assert.equal(h.values.updateStatus, 'failed');
  } finally { h.stop(); }
});

test('unstable update refuses install unless experimental opt-in is enabled', async () => {
  const h = harness({ stable: false, experimental: true });
  try {
    await drain();
    await h.update('unstable');
    assert.equal(h.calls.installs.length, 0);
    h.values.allowUnstable = true;
    await h.update('unstable');
    assert.equal(h.calls.installs.length, 1);
    assert.equal(h.values.updateStatus, 'restart-required');
  } finally { h.stop(); }
});
