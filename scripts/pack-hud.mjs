import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
mkdirSync(resolve(root, 'dist'), { recursive: true });
const args = ['pack', '--workspace', './plugins/hud', '--pack-destination', './dist'];
const windows = process.platform === 'win32';
const result = spawnSync(windows ? 'npm.cmd' : 'npm', args, {
  cwd: root,
  stdio: 'inherit',
  shell: windows,
});
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
