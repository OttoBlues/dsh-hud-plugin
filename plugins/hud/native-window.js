/**
 * Opt-in Windows-only native HUD. No Electron preload IPC, global shortcuts,
 * Shell window monkey-patching or remote commands are exposed to the client.
 * Only this fixed, bundled PowerShell/WPF resource can be launched.
 */
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HUD_SCRIPT = fileURLToPath(new URL('./native/windows-hud.ps1', import.meta.url));
const MAX_SESSIONS = 16;
const TITLE_LIMIT = 100;
export const HUD_STARTUP_TIMEOUT_MS = 45_000;

export function safeNativeSnapshot(raw) {
  let parsed;
  try { parsed = JSON.parse(typeof raw === 'string' ? raw : ''); } catch { parsed = {}; }
  const sessions = Array.isArray(parsed?.sessions) ? parsed.sessions : [];
  return JSON.stringify({
    capturedAt: typeof parsed?.capturedAt === 'string' &&
      !Number.isNaN(Date.parse(parsed.capturedAt)) ? parsed.capturedAt : '',
    sessions: sessions.slice(0, MAX_SESSIONS).map(row => ({
      title: String(row?.title || 'Untitled session').slice(0, TITLE_LIMIT),
      running: row?.running === true,
    })),
  });
}

export function launchWindowsHud({
  snapshot = '', language = 'zh', onReady = () => {}, onExit = () => {},
  platform = process.platform, shellPid = process.pid, hostPid = process.pid,
  parentPid = process.ppid,
  spawnProcess = spawn, startupTimeoutMs = HUD_STARTUP_TIMEOUT_MS, shutdownGraceMs = 2_000,
} = {}) {
  if (platform !== 'win32') throw new Error('Independent HUD requires DSH Desktop on Windows.');
  if (!Number.isSafeInteger(shellPid) || shellPid <= 0 ||
      !Number.isSafeInteger(hostPid) || hostPid <= 0 ||
      !Number.isSafeInteger(parentPid) || parentPid < 0) {
    throw new Error('Cannot identify the DSH Desktop and Host processes.');
  }
  // Data is delivered via stdin, NEVER as a command-line argument or URL.
  const args = [
    '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-STA',
    '-File', HUD_SCRIPT, '-ShellPid', String(shellPid),
    '-HostPid', String(hostPid), '-ParentPid', String(parentPid),
    '-Language', language === 'en' ? 'en' : 'zh',
  ];
  const child = spawnProcess('powershell.exe', args, {
    windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'],
  });
  let ready = false, finished = false, startupTimedOut = false;
  let output = '', failure = '', stderr = '', timeout, forcedStopTimer;
  const reportExit = (reason) => {
    if (finished) return;
    finished = true;
    clearTimeout(timeout);
    clearTimeout(forcedStopTimer);
    if (!ready && !failure) failure = String(reason || 'Native HUD did not report READY.');
    // In case WPF was terminated instead of closing normally, a second fixed
    // helper restores the hidden DSH window. It never executes client input.
    if (reason || !ready) {
      try {
        const restore = spawnProcess('powershell.exe', [
          '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-STA',
          '-File', HUD_SCRIPT, '-ShellPid', String(shellPid),
          '-HostPid', String(hostPid), '-ParentPid', String(parentPid), '-RestoreOnly',
        ], { windowsHide: true, stdio: 'ignore' });
        restore.unref?.();
      } catch { /* DSH remains recoverable via its regular application entry. */ }
    }
    onExit({ ready, error: failure || (reason ? String(reason) : '') });
  };
  const stop = () => {
    if (finished || child.stdin?.destroyed) return;
    try { child.stdin.end('EXIT\n'); } catch { /* Child already exited. */ }
  };
  timeout = setTimeout(() => {
    if (!ready && !finished) {
      startupTimedOut = true;
      failure = 'Native HUD startup timed out after ' +
        Math.ceil(startupTimeoutMs / 1000) + ' s.';
      stop();
      // A missing PowerShell/WPF startup must not leave a dangling helper.
      forcedStopTimer = setTimeout(() => { if (!finished) child.kill(); }, shutdownGraceMs);
      forcedStopTimer.unref?.();
    }
  }, startupTimeoutMs);
  timeout.unref?.();

  child.stdout?.on('data', chunk => {
    if (finished) return;
    output = (output + chunk.toString('utf8')).slice(-4096);
    for (const line of output.split(/\r?\n/).slice(0, -1)) {
      if (line.trim() === 'READY' && !ready) {
        if (startupTimedOut) {
          child.kill();
          return;
        }
        ready = true;
        clearTimeout(timeout);
        onReady();
      }
      if (line.startsWith('ERROR:')) failure = line.slice(0, 240);
    }
    output = output.includes('\n') ? output.slice(output.lastIndexOf('\n') + 1) : output;
  });
  child.stderr?.on('data', chunk => {
    stderr = (stderr + chunk.toString('utf8')).slice(-350);
  });
  child.on('error', error => reportExit(String(error?.message || 'Failed to start PowerShell.')));
  child.on('exit', (code, signal) => {
    if (!ready) failure = failure || stderr || 'PowerShell exited before READY.';
    reportExit(code === 0 && !signal ? '' : 'PowerShell exited with ' + String(code ?? signal));
  });

  try {
    child.stdin?.write(Buffer.from(safeNativeSnapshot(snapshot), 'utf8').toString('base64') + '\n');
  } catch (error) {
    failure = String(error?.message || 'Cannot send HUD session snapshot.');
    stop();
  }
  return { close: stop, isReady: () => ready };
}
