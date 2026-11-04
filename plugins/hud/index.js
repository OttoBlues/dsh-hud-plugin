/**
 * HUD component update bridge (Host, no direct network or credentials).
 *
 * Only reads a CI-verified, Runner-staged local catalog and writes a narrowly
 * scoped update request. All package installation remains in the Windows Runner
 * after it validates green CI and waits for the Desktop to exit.
 */
import Schema from '@deepseek-ai/schemastery';
import { readFile, mkdir, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';

const CURRENT_VERSION = '0.3.0';
const VERSION = /^\d+\.\d+\.\d+$/;
const PACKAGE_NAME = /^@local\/[a-z0-9][a-z0-9-]*$/;
const HASH = /^[0-9a-f]{64}$/i;
const COMMIT = /^[0-9a-f]{40}$/i;
const DEFAULT_CATALOG = '{"schema":2,"components":[]}';
const POLL_MS = 20_000;

export const Config = Schema.object({
  catalog: Schema.string().default(DEFAULT_CATALOG).volatile(),
  requestComponent: Schema.string().default('').volatile(),
  requestVersion: Schema.string().default('').volatile(),
  requestChannel: Schema.string().default('released').volatile(),
  allowUnstable: Schema.boolean().default(false).volatile(),
  overlayVisible: Schema.boolean().default(false).volatile(),
});

function isNewer(a, b) {
  if (!VERSION.test(a) || !VERSION.test(b)) return false;
  const left = a.split('.').map(Number);
  const right = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if (left[i] !== right[i]) return left[i] > right[i];
  }
  return false;
}

function normalizeCatalog(raw) {
  if (raw.length > 65536) throw new Error('catalog-too-large');
  const parsed = JSON.parse(raw);
  if (parsed?.schema !== 2 || !Array.isArray(parsed.components) || parsed.components.length > 64) {
    throw new Error('catalog-invalid');
  }
  const names = new Set();
  const components = parsed.components.map(item => {
    if (typeof item?.name !== 'string' || !PACKAGE_NAME.test(item.name) ||
        (item.channel !== 'released' && item.channel !== 'unstable') ||
        typeof item.version !== 'string' || !VERSION.test(item.version) ||
        typeof item.commit !== 'string' || !COMMIT.test(item.commit) ||
        typeof item.sha256 !== 'string' || !HASH.test(item.sha256)) {
      throw new Error('catalog-entry-invalid');
    }
    const unique = item.name + ':' + item.channel;
    if (names.has(unique)) throw new Error('catalog-duplicate');
    names.add(unique);
    // Never propagate local paths, tokens or unrecognized fields to the Client.
    return {
      name: item.name,
      channel: item.channel,
      version: item.version,
      commit: item.commit,
      sha256: item.sha256.toLowerCase(),
    };
  });
  return JSON.stringify({ schema: 2, components });
}

export function apply(ctx, config) {
  const home = process.env.DSH_HOME || join(homedir(), '.dsh');
  const base = join(home, 'component-updates');
  let running = false;
  let disposed = false;
  let preferenceWritten;

  async function tick() {
    if (disposed || running) return;
    running = true;
    try {
      // The Runner reads this restricted preference; no browser credentials are involved.
      const allowUnstable = config.allowUnstable.get() === true;
      if (preferenceWritten !== allowUnstable) {
        await mkdir(base, { recursive: true });
        const prefs = JSON.stringify({ schema: 1, allowUnstable });
        const tempPrefs = join(base, 'preferences-' + process.pid + '.tmp');
        await writeFile(tempPrefs, prefs, { mode: 0o600 });
        await rename(tempPrefs, join(base, 'preferences.json'));
        preferenceWritten = allowUnstable;
      }
      const raw = await readFile(join(base, 'catalog.json'), 'utf8');
      const catalog = normalizeCatalog(raw);
      if (!disposed && config.catalog.get() !== catalog) {
        const editor = ctx.get('configEditor');
        const entry = ctx.fiber?.entry;
        if (editor && entry) {
          await editor.edit(entry, current => ({ ...current, catalog }));
        }
      }

      const { components } = JSON.parse(catalog);
      const requestedName = config.requestComponent.get() || '';
      const requestedVersion = config.requestVersion.get() || '';
      const requestedChannel = config.requestChannel.get() || 'released';
      const available = components.find(item =>
        item.name === requestedName && item.version === requestedVersion &&
        item.channel === requestedChannel);
      // The installed package is pinned to the code currently executing.
      // The Runner independently checks installed and target versions.
      if (!disposed && available && requestedName === '@local/dsh-hud' &&
          (requestedChannel === 'released' || allowUnstable) &&
          isNewer(requestedVersion, CURRENT_VERSION)) {
        const request = JSON.stringify({
          schema: 2,
          name: requestedName,
          version: requestedVersion,
          channel: requestedChannel,
          sha256: available.sha256,
          commit: available.commit,
        });
        const path = join(base, 'request.json');
        await mkdir(base, { recursive: true });
        // Atomic replacement; the Runner will independently verify all data.
        const temp = join(base, 'request-' + process.pid + '.tmp');
        await writeFile(temp, request, { encoding: 'utf8', mode: 0o600 });
        await rename(temp, path);
      }
    } catch (error) {
      // The update service is optional; it must never stop the main DSH app.
      // Missing or stale local data is reported in the component view.
    } finally {
      running = false;
    }
  }

  ctx.effect(() => {
    void tick();
    const timer = setInterval(() => { void tick(); }, POLL_MS);
    return () => { disposed = true; clearInterval(timer); };
  }, 'dsh-hud: local component catalog');
}
