/**
 * DSH HUD v0.3 development Host.
 *
 * A public repository can be checked anonymously; a private repository returns
 * "unavailable", not a made-up latest version. This plugin does not store a
 * GitHub token. The legacy Windows Runner catalog is a temporary bootstrap
 * fallback, and is not needed once the approved releases are public.
 *
 * Installation is triggered ONLY by an explicit in-app confirmation and uses
 * the DSH Host pluginManager service. Never unpack Git HEAD source.
 */
import Schema from '@deepseek-ai/schemastery';
import { createHash } from 'node:crypto';
import { readFile, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir, homedir } from 'node:os';

export const inject = ['pluginManager'];

const CURRENT_VERSION = '0.3.0';
const PACKAGE = '@local/dsh-hud';
const ROOT = 'https://raw.githubusercontent.com/OttoBlues/dsh-plugins/main/plugins/hud';
const REGULAR = /^\d+\.\d+\.\d+$/;
const COMMIT = /^[a-f0-9]{40}$/i;
const HASH = /^[a-f0-9]{64}$/i;
const EMPTY = '{"schema":2,"components":[]}';
const MAX_BYTES = 25_000_000;
const CHECK_MS = 5 * 60_000;
const REQUEST_POLL_MS = 3000;

export const Config = Schema.object({
  catalog: Schema.string().default(EMPTY).volatile(),
  requestComponent: Schema.string().default('').volatile(),
  requestVersion: Schema.string().default('').volatile(),
  requestChannel: Schema.string().default('released').volatile(),
  requestNonce: Schema.string().default('').volatile(),
  allowUnstable: Schema.boolean().default(false).volatile(),
  overlayVisible: Schema.boolean().default(false).volatile(),
  updateStatus: Schema.string().default('').volatile(),
});

function newer(a, b) {
  if (!REGULAR.test(a) || !REGULAR.test(b)) return false;
  const x = a.split('.').map(Number), y = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if (x[i] !== y[i]) return x[i] > y[i];
  }
  return false;
}
function approvedEntry(index, channel) {
  if (index?.schema !== 1 || index.component !== 'hud' ||
      index.package !== PACKAGE || index.channel !== channel ||
      !Array.isArray(index.releases) || index.releases.length > 128) {
    throw new Error('Untrusted release index.');
  }
  if (index.latest === null && index.releases.length === 0) return null;
  if (typeof index.latest !== 'string' || !REGULAR.test(index.latest)) {
    throw new Error('Invalid channel release version.');
  }
  const found = index.releases.filter(row => row?.version === index.latest);
  if (found.length !== 1) throw new Error('Ambiguous release.');
  const row = found[0];
  if (row.file !== 'v' + row.version + '/local-dsh-hud-' + row.version + '.tgz' ||
      !COMMIT.test(row.sourceCommit) || !HASH.test(row.sha256)) {
    throw new Error('Untrusted release package identifier.');
  }
  if (channel === 'released' && (row.acceptance?.decision !== 'approved' ||
      !/^U\d{2,3}$/.test(row.acceptance?.check))) {
    throw new Error('Missing explicit stable acceptance.');
  }
  if (channel === 'unstable' &&
      (row.test?.result !== 'success' || !/^\d+$/.test(row.test?.ciRun))) {
    throw new Error('Test package has no accepted CI evidence.');
  }
  return {
    name: PACKAGE, version: row.version, channel,
    commit: row.sourceCommit.toLowerCase(),
    sha256: row.sha256.toLowerCase(), file: row.file,
  };
}

async function getBytes(url, maxBytes, signal) {
  // Hardcoded trusted origin, no redirects to untrusted destinations.
  const response = await fetch(url, {
    redirect: 'error', signal,
    headers: { accept: 'application/octet-stream' },
  });
  if (!response.ok) throw new Error('Release source HTTP ' + response.status);
  const indicated = Number(response.headers.get('content-length'));
  if (indicated > maxBytes) throw new Error('Release response exceeds limit.');
  const reader = response.body?.getReader();
  if (!reader) throw new Error('No release response body.');
  const chunks = [];
  let size = 0;
  while (true) {
    const item = await reader.read();
    if (item.done) break;
    size += item.value.byteLength;
    if (size > maxBytes) {
      await reader.cancel();
      throw new Error('Release response exceeds limit.');
    }
    chunks.push(item.value);
  }
  const output = Buffer.alloc(size);
  let offset = 0;
  for (const part of chunks) {
    output.set(part, offset);
    offset += part.byteLength;
  }
  return output;
}

async function readPublicChannel(channel, signal) {
  const bytes = await getBytes(ROOT + '/' + channel + '/index.json', 100_000, signal);
  return approvedEntry(JSON.parse(bytes.toString('utf8')), channel);
}

function normalizeLocal(raw) {
  if (raw.length > 65536) throw new Error('Oversized local catalog.');
  const data = JSON.parse(raw);
  if (data?.schema !== 2 || !Array.isArray(data.components) || data.components.length > 64) {
    throw new Error('Invalid local catalog.');
  }
  return data.components.filter(item =>
    item?.name === PACKAGE && REGULAR.test(item.version) &&
    (item.channel === 'released' || item.channel === 'unstable') &&
    COMMIT.test(item.commit) && HASH.test(item.sha256)
  ).map(item => ({
    name: PACKAGE, channel: item.channel, version: item.version,
    commit: item.commit.toLowerCase(), sha256: item.sha256.toLowerCase(),
    file: 'v' + item.version + '/local-dsh-hud-' + item.version + '.tgz',
  }));
}

export function apply(ctx, config) {
  let disposed = false;
  let checking = false;
  let updating = false;
  let lastRequest = '';
  const controller = new AbortController();
  const base = join(process.env.DSH_HOME || join(homedir(), '.dsh'), 'component-updates');
  const editor = ctx.get('configEditor');
  const entry = ctx.fiber?.entry;

  async function setFields(patch) {
    if (disposed || !editor || !entry) return false;
    await editor.edit(entry, old => ({ ...old, ...patch }));
    return true;
  }

  async function checkUpdates() {
    if (checking || disposed) return;
    checking = true;
    try {
      const found = [];
      // Do not send any authentication data to GitHub.
      for (const channel of ['released', 'unstable']) {
        try {
          const item = await readPublicChannel(channel, controller.signal);
          if (item) found.push(item);
        } catch {
          // Private GitHub repositories cannot be read anonymously.
          // The Runner's local channel catalog is only a bootstrap fallback.
        }
      }
      try {
        const local = normalizeLocal(await readFile(join(base, 'catalog.json'), 'utf8'));
        for (const item of local) {
          if (!found.some(existing => existing.channel === item.channel)) found.push(item);
        }
      } catch {
        // No local bootstrap cache is normal once running independently.
      }
      const catalog = JSON.stringify({
        schema: 2, components: found.map(item => ({
          name: item.name, version: item.version, channel: item.channel,
          commit: item.commit, sha256: item.sha256,
        })),
      });
      if (catalog !== config.catalog.get()) await setFields({ catalog });
    } catch {
      // An unavailable update service must never prevent DSH from loading.
    } finally {
      checking = false;
    }
  }

  async function installRequested() {
    if (updating || disposed) return;
    const nonce = config.requestNonce.get();
    if (typeof nonce !== 'string' || !nonce || nonce === lastRequest) return;
    lastRequest = nonce;
    const name = config.requestComponent.get();
    const version = config.requestVersion.get();
    const channel = config.requestChannel.get();
    if (name !== PACKAGE || !REGULAR.test(version) ||
        (channel !== 'released' && channel !== 'unstable') ||
        (channel === 'unstable' && config.allowUnstable.get() !== true) ||
        !newer(version, CURRENT_VERSION)) return;
    updating = true;
    let temporary = null;
    try {
      const item = await readPublicChannel(channel, controller.signal);
      if (!item || item.version !== version) {
        throw new Error('Requested version is not in an anonymously accessible approved channel.');
      }
      const listed = normalizeLocal(config.catalog.get()).find(row =>
        row.channel === channel && row.version === version);
      if (!listed || listed.sha256 !== item.sha256 || listed.commit !== item.commit) {
        throw new Error('The version has changed since confirmation; refresh before updating.');
      }

      const content = await getBytes(ROOT + '/' + channel + '/' + item.file, MAX_BYTES, controller.signal);
      if (createHash('sha256').update(content).digest('hex') !== item.sha256) {
        throw new Error('Installer hash differs from accepted manifest.');
      }
      temporary = await mkdtemp(join(tmpdir(), 'dsh-hud-update-'));
      const archive = join(temporary, 'local-dsh-hud-' + version + '.tgz');
      await writeFile(archive, content, { mode: 0o600 });
      // DSH's own manager enforces package policy; no shell commands or direct
      // writes to a profile and no restart/termination of the whole application.
      const result = await ctx.pluginManager.installBundle(archive, { enabled: true });
      if (result.application === 'failed' || result.application === 'cancelled') {
        throw new Error('DSH rejected the version: ' + (result.error?.code || result.application));
      }
      await setFields({
        updateStatus: result.application === 'restart-required' ? 'restart-required' : 'installed',
      });
    } catch (error) {
      if (!disposed) {
        // The status is intentionally terse; it contains no local paths/tokens.
        await setFields({ updateStatus: 'failed' }).catch(() => {});
        ctx.logger?.warn?.('DSH HUD update declined: %s', String(error?.message || 'unavailable'));
      }
    } finally {
      updating = false;
      if (temporary) await rm(temporary, { recursive: true, force: true }).catch(() => {});
    }
  }

  ctx.effect(() => {
    void checkUpdates();
    const check = setInterval(() => { void checkUpdates(); }, CHECK_MS);
    const request = setInterval(() => { void installRequested(); }, REQUEST_POLL_MS);
    return () => {
      disposed = true;
      controller.abort();
      clearInterval(check);
      clearInterval(request);
    };
  }, 'dsh-hud: anonymous update catalog and consented installer');
}
