/**
 * DSH HUD v0.5.17: keep Windows HUD input from blocking window startup.
 *  - repository catalog and release channels are read anonymously from HTTPS
 *  - only channel-listed, integrity-checked .tgz packages are installable
 *  - manual installs require a one-time UI confirmation
 *  - auto-update is OFF by default, stable-only unless separately opted in
 *  - no GitHub token, Windows Runner or shell command needed by the app
 *
 * This is a *development* source, not an accepted released/ build.
 */
import Schema from '@deepseek-ai/schemastery';
import { launchWindowsHud } from './native-window.js';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';

// Connection owns the authenticated /api bridge. Do not register feature RPCs
// as standalone WebServer prefixes: their Context may not own webServer.
export const inject = ['connection'];
// Keep the previous name as a temporary migration fallback. Once the user
// renames the repository, old raw URLs are NOT assumed to keep redirecting.
const ROOTS = [
  'https://raw.githubusercontent.com/OttoBlues/dsh-hud-plugin/main/plugins',
  'https://raw.githubusercontent.com/OttoBlues/dsh-plugins/main/plugins',
];
const CURRENT_NAME = '@local/dsh-hud';
const HOST_VERSION = '0.5.17';
const CATALOG_EMPTY = '{"schema":3,"source":"checking","components":[]}';
const SEMVER = /^\d+\.\d+\.\d+$/;
const HEX40 = /^[a-f0-9]{40}$/i;
const HEX64 = /^[a-f0-9]{64}$/i;
const SLUG = /^[a-z0-9][a-z0-9-]{0,63}$/;
const PACKAGE = /^@local\/[a-z0-9][a-z0-9-]{0,63}$/;
const MAX_ARCHIVE_BYTES = 25_000_000;
const CHECK_MS = 5 * 60_000;
const AUTO_RETRY_MS = 5 * 60_000;
const AUTO_MAX_ATTEMPTS = 3;
const AUTO_INSTALL_WAIT_MS = 90_000;
const REQUEST_MS = 850;
const SCAN_MS = 28_000; // Bound the entire network scan, not only each file.
const EDIT_MS = 6_000; // A stuck DSH ConfigEditor must not lock checks indefinitely.
const TIMEOUT_MS = 20_000;

export const Config = Schema.object({
  catalog: Schema.string().default(CATALOG_EMPTY).volatile(),
  // Manual refresh request and its observable outcome (never an install request).
  checkNonce: Schema.string().default('').volatile(),
  checkQueuedAt: Schema.string().default('').volatile(),
  scanAt: Schema.string().default('').volatile(),
  scanState: Schema.string().default('idle').volatile(),
  checkState: Schema.string().default('idle').volatile(),
  checkError: Schema.string().default('').volatile(),
  checkAt: Schema.string().default('').volatile(),
  checkOrigin: Schema.string().default('').volatile(),
  allowUnstable: Schema.boolean().default(false).volatile(),
  autoUpdateEnabled: Schema.boolean().default(false).volatile(),
  autoUpdateUnstable: Schema.boolean().default(false).volatile(),
  autoAttemptKey: Schema.string().default('').volatile(),
  overlayVisible: Schema.boolean().default(false).volatile(),
  // Opt-in HUD working mode; DSH's frame remains mounted underneath.
  hudMode: Schema.boolean().default(false).volatile(),
  nativeHudRequestNonce: Schema.string().default('').volatile(),
  nativeHudSnapshot: Schema.string().default('').volatile(),
  nativeHudLanguage: Schema.string().default('zh').volatile(),
  nativeHudState: Schema.string().default('idle').volatile(),
  nativeHudError: Schema.string().default('').volatile(),
  requestComponent: Schema.string().default('').volatile(),
  requestVersion: Schema.string().default('').volatile(),
  requestChannel: Schema.string().default('released').volatile(),
  requestNonce: Schema.string().default('').volatile(),
  updateStatus: Schema.string().default('').volatile(),
});

function newer(version, oldVersion) {
  if (!SEMVER.test(version)) return false;
  if (oldVersion === undefined || oldVersion === null || oldVersion === '') return true;
  if (!SEMVER.test(oldVersion)) return false;
  const a = version.split('.').map(Number);
  const b = oldVersion.split('.').map(Number);
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] > b[i];
  return false;
}

async function getBytes(url, maximum, signal) {
  if (!ROOTS.some(root => url.startsWith(root + '/'))) {
    throw new Error('Untrusted update URL.');
  }
  const response = await fetch(url, {
    redirect: 'error',
    signal: AbortSignal.any([signal, AbortSignal.timeout(TIMEOUT_MS)]),
    headers: { accept: 'application/octet-stream' },
  });
  if (!response.ok) throw new Error('Update source returned HTTP ' + response.status);
  const length = Number(response.headers.get('content-length'));
  if (Number.isFinite(length) && length > maximum) throw new Error('Response too large.');
  const reader = response.body?.getReader();
  if (!reader) throw new Error('No response body.');
  const blocks = [];
  let size = 0;
  while (true) {
    const data = await reader.read();
    if (data.done) break;
    size += data.value.byteLength;
    if (size > maximum) {
      await reader.cancel();
      throw new Error('Response too large.');
    }
    blocks.push(data.value);
  }
  const result = Buffer.alloc(size);
  let offset = 0;
  for (const block of blocks) { result.set(block, offset); offset += block.byteLength; }
  return result;
}
async function readJSON(root, path, signal) {
  return JSON.parse((await getBytes(root + '/' + path, 100_000, signal)).toString('utf8'));
}
async function selectRepository(signal) {
  let lastError;
  for (const root of ROOTS) {
    try {
      const components = checkRepositoryIndex(await readJSON(root, 'index.json', signal));
      return { root, components };
    } catch (error) {
      if (signal.aborted) throw error;
      lastError = error;
    }
  }
  throw lastError || new Error('No accessible anonymous component repository.');
}
function checkRepositoryIndex(value) {
  if (value?.schema !== 1 || !Array.isArray(value.components) ||
      value.components.length > 32) throw new Error('Invalid component registry.');
  const names = new Set(), ids = new Set();
  return value.components.map(item => {
    if (!SLUG.test(item?.id || '') || !PACKAGE.test(item?.name || '') ||
        typeof item.title !== 'string' || item.title.length < 1 || item.title.length > 90 ||
        typeof item.description !== 'string' || item.description.length > 300 ||
        names.has(item.name) || ids.has(item.id)) {
      throw new Error('Component manifest is invalid.');
    }
    names.add(item.name); ids.add(item.id);
    return { id:item.id, name:item.name, title:item.title, description:item.description };
  });
}
function parseRelease(index, component, channel) {
  if (index?.schema !== 1 || index.component !== component.id ||
      index.package !== component.name || index.channel !== channel ||
      !Array.isArray(index.releases) || index.releases.length > 128) {
    throw new Error('Invalid channel index.');
  }
  if (index.latest === null && index.releases.length === 0) return null;
  if (typeof index.latest !== 'string' || !SEMVER.test(index.latest)) {
    throw new Error('Invalid advertised version.');
  }
  const rows = index.releases.filter(item => item?.version === index.latest);
  if (rows.length !== 1) throw new Error('Ambiguous version.');
  const item = rows[0];
  const file = 'v' + item.version + '/local-dsh-' + component.id + '-' + item.version + '.tgz';
  if (item.file !== file || !HEX64.test(item.sha256 || '') ||
      !HEX40.test(item.sourceCommit || '')) throw new Error('Invalid release archive facts.');
  if (channel === 'released' &&
      (item.acceptance?.decision !== 'approved' || !/^U\d{2,3}$/.test(item.acceptance?.check || ''))) {
    throw new Error('Stable version lacks user acceptance.');
  }
  if (channel === 'unstable' &&
      (item.test?.result !== 'success' || !/^\d+$/.test(item.test?.ciRun || ''))) {
    throw new Error('Experimental build lacks green CI.');
  }
  return {
    channel, version: item.version, file,
    sha256: item.sha256.toLowerCase(),
    commit: item.sourceCommit.toLowerCase(),
  };
}
async function readChannel(root, component, channel, signal) {
  return parseRelease(await readJSON(root, component.id + '/' + channel + '/index.json', signal), component, channel);
}
function selectRelease(entry, acceptUnstable) {
  let best = entry.released;
  if (acceptUnstable && entry.unstable &&
      (!best || newer(entry.unstable.version, best.version))) {
    best = entry.unstable;
  }
  return best || null;
}

export function apply(ctx, config) {
  let disposed = false, checking = false, updating = false, manualChecking = false;
  let lastNonce = String(config.requestNonce.get() || ''); // no replay of a stale UI consent after a Host reload
  let lastCheckNonce = '';
  // Native HUD is transient process state, not a DSH Loader configuration request.
  let nativeHudWindow = null;
  let retryCheckAfter = 0;
  let lastMissingEditorWarning = 0;
  const controller = new AbortController();
  const cacheRoot = join(process.env.DSH_HOME || join(homedir(), '.dsh'), 'approved-component-packages');
  const autoLedgerFor = id => join(cacheRoot,id,'.auto-attempt.json');
  const runtime = {scanAt:'',scanState:'idle',scanError:'',autoAt:'',autoState:'idle',autoError:''};
  const autoWatchdogs = new Set();
  let autoOutcomeQueue = Promise.resolve();

  async function writeAutoLedger(id, record) {
    const directory = join(cacheRoot,id);
    await mkdir(directory,{recursive:true,mode:0o700});
    if (disposed) return false;
    const ledgerPath = autoLedgerFor(id);
    const temporaryLedger = ledgerPath + '.' + process.pid + '.' + randomUUID() + '.tmp';
    await writeFile(temporaryLedger,JSON.stringify(record),{mode:0o600});
    if (disposed) return false;
    await rename(temporaryLedger,ledgerPath);
    return true;
  }

  function recordAutoOutcome(component, attempt, state, error = '') {
    if (!attempt || disposed) return;
    const task = autoOutcomeQueue.then(async () => {
      if (disposed) return;
      const previous = JSON.parse(await readFile(autoLedgerFor(component.id),'utf8'));
      if (disposed || previous.key !== attempt.key || previous.attemptId !== attempt.attemptId) return;
      await writeAutoLedger(component.id,{
        ...previous, state, error:String(error).slice(0,240),
        retryAfter:state === 'failed' ? Date.now() + AUTO_RETRY_MS : null,
      });
    });
    autoOutcomeQueue = task.catch(error => {
      if (!disposed) ctx.logger?.warn?.('HUD automatic update outcome could not be recorded: %s',
        String(error?.message || error));
    });
  }

  function setAutoOutcome(component, attempt, state, error = '') {
    if (disposed) return;
    runtime.autoState = state;
    runtime.autoError = String(error).slice(0,240);
    recordAutoOutcome(component,attempt,state,runtime.autoError);
  }

  async function writeSettings(patch) {
    if (disposed) return false;
    // This service/entry can become available after this plugin starts.
    // Caching an undefined ConfigEditor during apply() permanently prevents
    // every Host -> Client status update (the UI can only show 'queued').
    const editor = ctx.get('configEditor');
    // Match the same unique, profile-editable Loader entry used by native
    // DSH SettingsForms, not the optional ctx.fiber.entry shortcut. The
    // shortcut can be absent or point to an unrelated nested entry.
    const entries = typeof editor?.entries === 'function' ? editor.entries() : null;
    const entry = entries
      ? entries.find(row => row.options?.id === 'dsh-hud')
      : ctx.fiber?.entry;
    if (!editor || typeof editor.edit !== 'function' || !entry) {
      if (Date.now() - lastMissingEditorWarning > 5_000) {
        lastMissingEditorWarning = Date.now();
        try { ctx.logger?.warn?.('HUD check cannot write: ConfigEditor or profile-editable dsh-hud entry unavailable'); }
        catch { /* Disposing plugin */ }
      }
      return false;
    }
    // Bound ConfigEditor too. A stale Host may be unable to edit its entry
    // after hot-reload, which previously left checkState='checking' forever.
    let timer;
    try {
      const edit = Promise.resolve().then(() =>
        editor.edit(entry, current => ({ ...current, ...patch })));
      const timeout = new Promise((_,reject) => {
        timer=setTimeout(() => reject(new Error('DSH ConfigEditor timeout')), EDIT_MS);
      });
      await Promise.race([edit,timeout]);
      return !disposed;
    } catch (error) {
      if (!disposed) {
        try { ctx.logger?.warn?.('HUD settings edit was not applied (%s)', String(error?.message || 'inactive')); }
        catch { /* Disposed Host may have no logger */ }
      }
      return false;
    } finally {
      clearTimeout(timer);
    }
  }

  function pluginManager() {
    // This service is optional for native window and settings availability.
    // A pending/unavailable manager must not prevent HUD Host activation.
    const manager = ctx.get('pluginManager');
    if (!manager) throw new Error('DSH Plugin Manager is not ready in this Host.');
    return manager;
  }

  async function installedRows() {
    const rows = await pluginManager().listBundles();
    if (!Array.isArray(rows)) throw new Error('DSH plugin inventory unavailable.');
    return rows;
  }

  // Resolve the fixed public channel again and pin the exact SHA-256-verified
  // bytes to an immutable local path. This function does not edit the DSH profile.
  async function verifiedPackagePath(component, approved, signal) {
    // Re-fetch the channel just before use; a stale or revoked version is
    // never installed even when it was displayed in an earlier UI snapshot.
    const selected = await selectRepository(signal);
    const fresh = selected.components.find(item =>
      item.id === component.id && item.name === component.name);
    if (!fresh) throw new Error('The component is no longer in the public registry.');
    const latest = await readChannel(selected.root, fresh, approved.channel, signal);
    if (!latest || latest.version !== approved.version ||
        latest.sha256 !== approved.sha256 || latest.commit !== approved.commit) {
      throw new Error('Update was revoked or changed; refresh its listing.');
    }
    const bytes = await getBytes(selected.root + '/' + component.id + '/' +
      approved.channel + '/' + approved.file, MAX_ARCHIVE_BYTES, signal);
    if (createHash('sha256').update(bytes).digest('hex') !== approved.sha256) {
      throw new Error('SHA-256 mismatch; refusing package.');
    }

    // pnpm may pin the tarball path. Keep an immutable, hash-addressed local
    // copy instead of deleting the only path after pluginManager returns.
    const directory = join(cacheRoot, component.id, approved.version);
    await mkdir(directory, { recursive: true, mode: 0o700 });
    const target = join(directory, approved.sha256 + '.tgz');
    const temporary = target + '.' + process.pid + '.' + randomUUID() + '.tmp';
    await writeFile(temporary, bytes, { mode: 0o600 });
    await rename(temporary, target);

    return target;
  }

  async function installComponent(component, approved, origin, preparedTarget = null, attempt = null) {
    if (updating || disposed || !approved) return false;
    updating = true;
    let wasApplied = false;
    let detachedSelfUpdate = false, failureOutcome = 'unconfirmed';
    try {
      const current = (await installedRows()).find(row => row.name === component.name && row.installed);
      if (!newer(approved.version, current?.version)) throw new Error('No newer reviewed version.');
      if (approved.channel === 'unstable' && config.allowUnstable.get() !== true) {
        throw new Error('Experimental update option is disabled.');
      }

      const target = preparedTarget || await verifiedPackagePath(component, approved, controller.signal);

      if (component.name === CURRENT_NAME) {
        // Self-update can unload this Host before the manager's promise
        // settles. Never write old-instance config or query inventory after
        // replacing this very bundle. The next Host startup reconciles status.
        const task = pluginManager().installBundle(target, {
          enabled: true, saveExact: true,
        });
        let watchdog = null;
        if (origin === 'automatic') {
          watchdog = setTimeout(() => {
            autoWatchdogs.delete(watchdog);
            if (!disposed) setAutoOutcome(component,attempt,'unconfirmed',
              'Plugin Manager has not confirmed the installation; check DSH Plugins before retrying.');
          },AUTO_INSTALL_WAIT_MS);
          watchdog.unref?.();
          autoWatchdogs.add(watchdog);
        }
        const clearWatchdog = () => {
          if (watchdog !== null) { clearTimeout(watchdog); autoWatchdogs.delete(watchdog); }
        };
        Promise.resolve(task).then(
          result => {
            clearWatchdog();
            if (disposed) return;
            updating = false;
            if (result && ((result.bundle !== undefined && result.bundle !== component.name) ||
                (result.version !== undefined && result.version !== approved.version))) {
              setAutoOutcome(component,attempt,'unconfirmed',
                'Plugin Manager returned facts for a different component or version.');
            } else if (result?.application === 'failed' ||
                (origin !== 'automatic' && result?.application === 'overridden')) {
              setAutoOutcome(component,attempt,'failed',result.error?.diagnostic||result.error?.code||
                'Plugin Manager rejected the update');
              ctx.logger?.warn?.('HUD self-update result: %s',runtime.autoError);
            } else if (result?.application === 'cancelled') {
              setAutoOutcome(component,attempt,'cancelled','Plugin Manager cancelled the update.');
            } else if (!result || !['applied','restart-required'].includes(result.application)) {
              setAutoOutcome(component,attempt,'unconfirmed',
                'Plugin Manager did not confirm the requested component and version.');
            } else {
              setAutoOutcome(component,attempt,
                result.application==='restart-required'?'restart-required':'submitted');
            }
          },
          error => {
            clearWatchdog();
            if (disposed) return;
            updating = false;
            setAutoOutcome(component,attempt,'unconfirmed',error?.message||error);
            ctx.logger?.warn?.('HUD self-update promise rejected: %s',runtime.autoError);
          },
        );
        detachedSelfUpdate = true;
        return true; // accepted for processing, NOT proof of installation
      }

      const result = await pluginManager().installBundle(target, {
        enabled: true, saveExact: true,
      });
      if (disposed) return false;
      failureOutcome = result?.application === 'failed' ? 'failed' :
        result?.application === 'cancelled' ? 'cancelled' : 'unconfirmed';
      if (!result || !['applied', 'restart-required'].includes(result.application) ||
          (result.bundle !== undefined && result.bundle !== component.name) ||
          (result.version !== undefined && result.version !== approved.version)) {
        throw new Error('DSH did not accept the exact component version.');
      }
      const after = (await installedRows()).find(row => row.name === component.name && row.installed);
      if (disposed) return false;
      if (!after || after.version !== approved.version) {
        throw new Error('Installed DSH version does not match the update manifest.');
      }
      wasApplied = true;
      if (origin === 'automatic') setAutoOutcome(component,attempt,
        result.application === 'restart-required' ? 'restart-required' : 'installed');
      if (origin !== 'automatic') await writeSettings({ updateStatus: result.application === 'restart-required' ?
        'restart-required' : 'installed' });
      return true;
    } catch (error) {
      if (!disposed) {
        if (origin === 'automatic') setAutoOutcome(component,attempt,failureOutcome,error?.message||error);
        else await writeSettings({ updateStatus: 'failed' }).catch(() => {});
        ctx.logger?.warn?.('Component %s update from %s failed: %s',
          component.name, origin, String(error?.message || 'unavailable'));
      }
      return false;
    } finally {
      if (!detachedSelfUpdate) updating = false;
      if (wasApplied && !disposed) {
        try { ctx.logger?.info?.('Approved component updated: %s', component.name); }
        catch { /* Host may have been disposed */ }
      }
    }
  }

  function diagnostic(error) {
    return String(error?.message || 'Network/manifest verification failed')
      .replace(/https?:\/\/\S+/gi, '[public source]').slice(0, 150);
  }

  async function discover(manual = false, nonce = '') {
    if (disposed || checking) return false;
    checking = true;
    const signal = AbortSignal.any([controller.signal,AbortSignal.timeout(SCAN_MS)]);
    try {
      // A hung fetch must release checking before the next five-minute poll.
      const repository = await selectRepository(signal);
      const problems = [];
      const components = repository.components;
      const rows = await Promise.all(components.map(async component => {
        const channels = await Promise.all(['released','unstable'].map(async channel => {
          try { return await readChannel(repository.root, component, channel, signal); }
          catch (error) {
            // A visible manual check must distinguish a missing channel from
            // "up to date"; an absent stable release index is NOT a success.
            problems.push(component.id + '/' + channel + ': ' + diagnostic(error));
            return null;
          }
        }));
        return { ...component, released:channels[0], unstable:channels[1] };
      }));
      const catalog = { schema:3, source:'public', components:rows };
      runtime.scanAt = new Date().toISOString();
      runtime.scanState = problems.length?'partial':'success';
      runtime.scanError = problems.join(' | ').slice(0,450);
      // Ignore an obsolete result when the user has retried with a new nonce.
      if (manual && config.checkNonce.get() !== nonce) return false;
      const patch = {
        scanAt:new Date().toISOString(), scanState:problems.length?'partial':'success',
      };
      if (JSON.stringify(catalog) !== config.catalog.get()) {
        patch.catalog = JSON.stringify(catalog);
      }
      if (manual) {
        patch.checkNonce = '';
        patch.checkState = problems.length ? 'partial' : 'success';
        patch.checkError = problems.join(' | ').slice(0, 480);
        patch.checkAt = new Date().toISOString();
        patch.checkOrigin = repository.root.includes('/dsh-hud-plugin/') ? 'canonical' : 'legacy';
      }
      // The client now checks publicly without Host config changes. Editing
      // scanAt on every startup used to recompose and dispose this very Host,
      // before its RPC routes and installer could process their work.
      if (manual && Object.keys(patch).length && !(await writeSettings(patch))) {
        // Never claim a scan completed when no version facts reached DSH UI.
        try { ctx.logger?.warn?.('HUD discovery read completed but config status write failed'); }
        catch { /* logger may be disposed */ }
        return false;
      }
      if (manual) {
        try { ctx.logger?.info?.('HUD manual release scan completed: %s', patch.checkState); }
        catch { /* logger may be disposed */ }
      }
      // Clicking "check" must never trigger an installation, even when
      // automatic-update preferences are enabled.
      if (!manual && config.autoUpdateEnabled.get() === true && !disposed && !updating) {
        const installed = await installedRows();
        for (const component of rows) {
          const row = installed.find(x => x.name === component.name && x.installed);
          if (!row) continue; // Never silently install a new component.
          const includeExperimental = config.allowUnstable.get() === true &&
            config.autoUpdateUnstable.get() === true;
          const approved = selectRelease(component, includeExperimental);
          if (!approved || !newer(approved.version, row.version)) continue;
          const key = component.name + ':' + approved.channel + ':' + approved.version + ':' + approved.sha256;
          // Retry only confirmed failures, with backoff and a fixed limit.
          // A pending, cancelled or unknown outcome must never be replayed.
          let previous = null;
          try {
            previous = JSON.parse(await readFile(autoLedgerFor(component.id),'utf8'));
          } catch (error) {
            if (error?.code !== 'ENOENT') {
              runtime.autoState='unconfirmed';
              runtime.autoError='Automatic update record is unreadable; check DSH Plugins before retrying.';
              ctx.logger?.warn?.('HUD automatic update record is unreadable: %s',String(error?.message||error));
              continue;
            }
          }
          const sameAttempt = previous?.key === key;
          if (sameAttempt && (previous.state !== 'failed' ||
              !Number.isSafeInteger(previous.attempts) || previous.attempts >= AUTO_MAX_ATTEMPTS ||
              !Number.isFinite(previous.retryAfter) || Date.now() < previous.retryAfter)) continue;
          if (!sameAttempt && config.autoAttemptKey.get() === key) continue;
          // A failed network/manifest read must not burn the auto-update attempt.
          const verifiedTarget=await verifiedPackagePath(component,approved,signal);
          if (disposed) break;
          const attempt={key,attemptId:randomUUID(),state:'submitted',
            attempts:sameAttempt ? previous.attempts + 1 : 1,at:new Date().toISOString()};
          if (!(await writeAutoLedger(component.id,attempt))) break;
          runtime.autoAt=new Date().toISOString();
          runtime.autoState='submitted'; // pending, not proof of success
          runtime.autoError='';
          ctx.logger?.info?.('HUD auto-update accepted for %s %s', component.name, approved.version);
          const accepted = await installComponent(component, approved, 'automatic',verifiedTarget,attempt);
          if (!disposed && !accepted && runtime.autoState === 'submitted') {
            setAutoOutcome(component,attempt,'unconfirmed',
              'Install operation did not confirm success; check DSH Plugin Manager.');
          }
          // Do not overwrite an authoritative failed/restart-required result
          // reported by the detached Plugin Manager callback.
          break; // One package change per periodic update check.
        }
      }
      return true;
    } catch (error) {
      // Do not turn a failed manual lookup into a false "up-to-date" state.
      if (manual && config.checkNonce.get() !== nonce) return false;
      const offline = '{"schema":3,"source":"unavailable","components":[]}';
      runtime.scanAt=new Date().toISOString();
      runtime.scanState='failed';
      runtime.scanError=diagnostic(error);
      const patch = {scanAt:runtime.scanAt,scanState:'failed'};
      if (!disposed && config.catalog.get() !== offline) patch.catalog = offline;
      if (manual) {
        patch.checkNonce = '';
        patch.checkState = 'failed';
        patch.checkError = diagnostic(error);
        patch.checkAt = new Date().toISOString();
        patch.checkOrigin = '';
      }
      if (manual && !disposed && Object.keys(patch).length) await writeSettings(patch);
      return false;
    } finally {
      checking = false;
    }
  }

  async function processCheckRequest() {
    if (disposed || checking || updating || manualChecking) return;
    const nonce = config.checkNonce.get();
    if (typeof nonce !== 'string' || !nonce || nonce === lastCheckNonce) return;
    if (Date.now() < retryCheckAfter) return;
    manualChecking = true;
    try {
      // Do not write a transient "checking" state before scanning:
      // ConfigEditor.edit reconciles the Loader/profile and may invalidate
      // this Host. One atomic result write is safer than two profile reloads.
      lastCheckNonce = nonce;
      try { ctx.logger?.info?.('HUD Host received manual check request'); }
      catch { /* logger may be disposed */ }
      const completed = await discover(true, nonce);
      if (!completed && !disposed && config.checkNonce.get() === nonce) {
        // The same nonce remains pending until a successful commit. Retry
        // after backoff, rather than spinning or silently consuming it.
        lastCheckNonce = '';
        retryCheckAfter = Date.now() + 3_000;
      } else if (completed) {
        retryCheckAfter = 0;
      }
    } catch (error) {
      if (!disposed && config.checkNonce.get() === nonce) {
        const saved = await writeSettings({
          checkNonce:'', checkState:'failed',
          checkError:diagnostic(error), checkAt:new Date().toISOString(),
        });
        if (!saved) {
          lastCheckNonce = '';
          retryCheckAfter = Date.now() + 3_000;
        }
      }
    } finally {
      manualChecking = false;
    }
  }

  async function processManualRequest() {
    if (disposed || updating || manualChecking) return;
    const nonce = config.requestNonce.get();
    if (!nonce || typeof nonce !== 'string' || nonce === lastNonce) return;
    lastNonce = nonce;
    const name = config.requestComponent.get(), version = config.requestVersion.get();
    const channel = config.requestChannel.get();
    if (!PACKAGE.test(name || '') || !SEMVER.test(version || '') ||
        (channel !== 'released' && channel !== 'unstable') ||
        (channel === 'unstable' && config.allowUnstable.get() !== true)) return;

    // Consume consent before any network action so restart cannot replay it.
    try {
      if (!(await writeSettings({ requestNonce:'', updateStatus:'installing' }))) return;
      if (disposed) return;
      const catalog = JSON.parse(config.catalog.get() || '{}');
      const component = catalog.components?.find(x => x.name === name);
      const approved = component?.[channel];
      if (!component || !approved || approved.version !== version) {
        await writeSettings({ updateStatus:'failed' });
        return;
      }
      await installComponent(component, approved, 'manual');
    } catch (error) {
      // An error from a previous, invalidated plugin entry must not crash DSH.
      if (!disposed) {
        await writeSettings({ updateStatus:'failed' });
        try { ctx.logger?.warn?.('HUD manual update aborted: %s', String(error?.message || 'invalidated')); }
        catch { /* Host may have been disposed */ }
      }
    }
  }



  const rpcFail = (code, message) => ({ok:false,error:{
    code,message:String(message || 'Unknown HUD Host error.').slice(0,450),details:{},
  }});

  function nativeRpcRoute(endpoint, handle) {
    const method = 'hud-native.' + endpoint;
    return {
      path: '/api/' + method,
      methods: ['POST'],
      requestBody: 'buffered',
      async fetch(request) {
        let message;
        try {
          message = await request.json();
        } catch {
          return new Response('Invalid HUD RPC request.', {status:400});
        }
        if (!message || message.type !== 'client-request' ||
            message.method !== method || typeof message.rpcId !== 'string' ||
            message.rpcId.length === 0) {
          return new Response('Invalid HUD RPC envelope.', {status:400});
        }
        let result;
        try {
          result = await handle(message.payload, request.signal, ctx.connection.browserPeer);
        } catch (error) {
          result = rpcFail('hud/internal', error?.message || error);
        }
        return Response.json({type:'server-response',rpcId:message.rpcId,result}, {
          headers:{'cache-control':'no-store'},
        });
      },
    };
  }

  ctx.effect(() => ctx.connection.fetch.register(nativeRpcRoute('open',
    (payload, signal, peer) => openNativeHud(payload, signal, peer))),
  'dsh-hud: /api/hud-native.open');
  ctx.effect(() => ctx.connection.fetch.register(nativeRpcRoute('prepare-install',
    (payload, signal, peer) => prepareInstall(payload, signal, peer))),
  'dsh-hud: /api/hud-native.prepare-install');
  ctx.effect(() => ctx.connection.fetch.register(nativeRpcRoute('status',
    (_payload, _signal, peer) => Promise.resolve(peer?.principal?.kind === 'owner'
      ? {ok:true,value:{hostVersion:HOST_VERSION,scanAt:runtime.scanAt,
          scanState:runtime.scanState,scanError:runtime.scanError,
          autoAt:runtime.autoAt,autoState:runtime.autoState,
          autoError:runtime.autoError}}
      : rpcFail('hud/forbidden','Owner access required.')))),
  'dsh-hud: /api/hud-native.status');

  async function prepareInstall(payload, signal, peer) {
    if (disposed) return rpcFail('hud/host-disposed','HUD Host is shutting down.');
    if (peer?.principal?.kind !== 'owner') return rpcFail('hud/forbidden','Owner access required.');
    if (!payload || typeof payload !== 'object' ||
      !SLUG.test(payload.id || '') || !PACKAGE.test(payload.name || '') ||
      !SEMVER.test(payload.version || '') ||
      !['released','unstable'].includes(payload.channel)) {
      return rpcFail('hud/invalid-install','Invalid component, version or channel.');
    }
    if (payload.channel === 'unstable' && config.allowUnstable.get() !== true) {
      return rpcFail('hud/unstable-disabled','Unstable channel requires explicit approval.');
    }
    try {
      const scopedSignal=AbortSignal.any([
        controller.signal,signal || controller.signal,AbortSignal.timeout(SCAN_MS),
      ]);
      const repository=await selectRepository(scopedSignal);
      const component=repository.components.find(row =>
        row.id===payload.id && row.name===payload.name);
      if (!component) throw new Error('Component not in the fixed public registry.');
      const approved=await readChannel(repository.root,component,payload.channel,scopedSignal);
      if (!approved || approved.version!==payload.version) {
        throw new Error('Requested version is not current in the verified release channel.');
      }
      const current=(await installedRows()).find(row=>row.name===component.name && row.installed);
      if (!newer(approved.version,current?.version)) {
        throw new Error('The requested package is already installed, or not newer.');
      }
      const target=await verifiedPackagePath(component,approved,scopedSignal);
      if (disposed || scopedSignal.aborted) return rpcFail('hud/cancelled','Preparation was interrupted.');
      ctx.logger?.info?.('HUD prepared SHA-256 verified %s %s',component.name,approved.version);
      return {ok:true,value:{path:target,name:component.name,version:approved.version,
        channel:approved.channel,sha256:approved.sha256}};
    } catch(error) {
      ctx.logger?.warn?.('HUD prepare-install failed: %s',String(error?.message||error));
      return rpcFail('hud/prepare-failed',error?.message||error);
    }
  }

  // Use official Connection unary RPC, not ConfigEditor/volatile-update as a
  // command queue. Each click receives the actual native launch result.
  function openNativeHud(payload, signal, peer) {
    const failed = (code, message) => ({ ok:false, error:{
      code, message:String(message || 'Unknown native HUD failure.').slice(0,450),details:{},
    } });
    if (disposed) return Promise.resolve(failed('hud/host-disposed','HUD Host is shutting down.'));
    if (peer?.principal?.kind !== 'owner') {
      return Promise.resolve(failed('hud/forbidden','Native HUD requires an authenticated owner.'));
    }
    if (nativeHudWindow !== null) {
      return Promise.resolve(failed('hud/already-open','A native HUD window is already opening or open.'));
    }
    if (!payload || typeof payload.snapshot !== 'string' ||
      payload.snapshot.length > 16_000 || !['zh','en'].includes(payload.language)) {
      return Promise.resolve(failed('hud/bad-request','Invalid HUD launch snapshot or language.'));
    }
    if (signal?.aborted) return Promise.resolve(failed('hud/cancelled','HUD launch was cancelled.'));
    return new Promise(resolve => {
      let answered = false;
      const answer = value => {
        if (answered) return;
        answered = true;
        signal?.removeEventListener?.('abort', cancel);
        resolve(value);
      };
      const cancel = () => {
        nativeHudWindow?.close();
        answer(failed('hud/cancelled','Native HUD launch was cancelled or timed out.'));
      };
      signal?.addEventListener?.('abort', cancel, {once:true});
      try {
        ctx.logger?.info?.('HUD native RPC: launching Windows WPF window');
        nativeHudWindow = launchWindowsHud({
          snapshot: payload.snapshot, language:payload.language,
          onReady: () => {
            if (disposed || signal?.aborted) { cancel(); return; }
            ctx.logger?.info?.('HUD native RPC: WPF READY, DSH window hidden');
            answer({ok:true,value:{state:'open'}});
          },
          onExit: ({ready,error}) => {
            nativeHudWindow = null;
            if (disposed) return;
            if (!ready) {
              ctx.logger?.warn?.('HUD native RPC startup failed: %s',String(error||'unknown'));
              answer(failed('hud/native-start-failed',error ||
                'WPF exited before the independent HUD appeared.'));
            } else if (error) {
              ctx.logger?.warn?.('HUD native window exited: %s',String(error));
            }
          },
        });
      } catch (error) {
        nativeHudWindow = null;
        ctx.logger?.warn?.('HUD native RPC unavailable: %s',String(error?.message || error));
        answer(failed('hud/native-unavailable',error?.message || error));
      }
    });
  }

  // After a self-update the old Host can vanish before acknowledging success.
  // The newly loaded version reconciles the result from DSH's installed facts,
  // without trusting the previous version's post-install callbacks.
  async function reconcileAfterReload() {
    if (disposed || updating) return;
    let expected;
    if (config.requestComponent.get() === CURRENT_NAME) {
      expected = config.requestVersion.get();
    } else {
      // Automatic self-updates have an attempt key instead of a manual nonce.
      const parts = String(config.autoAttemptKey.get() || '').split(':');
      if (parts[0] === CURRENT_NAME && ['released','unstable'].includes(parts[1])) {
        expected = parts[2];
      }
    }
    if (!SEMVER.test(expected || '')) return;
    if (!['installing','failed','queued'].includes(config.updateStatus.get())) return;
    try {
      const current = (await installedRows()).find(row =>
        row.name === CURRENT_NAME && row.installed);
      if (disposed) return;
      if (current?.version === expected) {
        await writeSettings({ updateStatus: 'installed', requestNonce: '' });
      } else if (config.updateStatus.get() === 'installing') {
        await writeSettings({ updateStatus: 'failed', requestNonce: '' });
      }
    } catch {
      // A transient startup error must never crash or claim success.
    }
  }

  ctx.effect(() => {
    const guarded = promise => {
      Promise.resolve(promise).catch(error => {
        if (!disposed) {
          try { ctx.logger?.warn?.('HUD background update check failed: %s', String(error?.message || 'unknown')); }
          catch { /* logger may already be disposed */ }
        }
      });
    };
    guarded((async()=>{
      try {
        const record=JSON.parse(await readFile(autoLedgerFor('hud'),'utf8'));
        const parts=String(record.key||'').split(':');
        if(parts[0]===CURRENT_NAME && SEMVER.test(parts[2]||'')){
          const row=(await installedRows()).find(item=>item.name===CURRENT_NAME && item.installed);
          if (disposed || runtime.autoState !== 'idle') return;
          runtime.autoAt=typeof record.at==='string'?record.at:'';
          runtime.autoState=row?.version===parts[2]?'installed':
            record.state==='failed'?'failed':record.state==='cancelled'?'cancelled':
              record.state==='restart-required'?'restart-required':'unconfirmed';
          runtime.autoError=typeof record.error==='string'?record.error.slice(0,240):'';
        }
      }catch { /* Fresh profile has no previous automatic attempt. */ }
    })());
    guarded(discover());
    // Volatile configuration writes from the DSH client are observable
    // without remounting this plugin. Listen immediately; the 850 ms timer
    // remains as a fallback for runtimes without the event.
    ctx.on?.('loader/volatile-update', () => {
      if (!disposed && config.checkNonce.get()) guarded(processCheckRequest());
    });
    const reconcile = setTimeout(() => { if (!disposed) guarded(reconcileAfterReload()); }, 1500);
    const poll = setInterval(() => { if (!disposed) guarded(discover()); }, CHECK_MS);
    const requests = setInterval(() => {
      if (!disposed) {
        guarded(processCheckRequest());
        guarded(processManualRequest());
      }
    }, REQUEST_MS);
    return () => {
      disposed = true;
      nativeHudWindow?.close();
      nativeHudWindow = null;
      controller.abort();
      for (const watchdog of autoWatchdogs) clearTimeout(watchdog);
      autoWatchdogs.clear();
      clearTimeout(reconcile);
      clearInterval(poll);
      clearInterval(requests);
    };
  }, 'dsh-components: anonymous manifest + update service');
}
