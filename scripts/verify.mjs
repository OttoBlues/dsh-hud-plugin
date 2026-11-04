import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const pluginsDirectory = join(root, 'plugins');
const pluginDirs = readdirSync(pluginsDirectory).filter((folder) =>
  statSync(join(pluginsDirectory, folder)).isDirectory());
assert(pluginDirs.length > 0, 'No plugins found under plugins/');
const seenNames = new Set();
const seenIds = new Set();
for (const folder of pluginDirs) {
  const base = join(pluginsDirectory, folder);
  const read = (p) => readFileSync(join(base, p), 'utf8');
  const manifest = JSON.parse(read('package.json'));
  assert(manifest.name && !seenNames.has(manifest.name), `Duplicate or missing plugin name: ${folder}`);
  seenNames.add(manifest.name);
  assert.equal(manifest.private, true, `${folder}: must remain private at this stage`);
  assert.equal(manifest.dsh?.bundle?.patch, './cordis.patch.yml', `${folder}: DSH bundle patch missing`);
  assert.equal(manifest.dsh?.client?.platform, 'web', `${folder}: requires DSH Client module`);
  assert.equal(manifest.dsh?.client?.immediately, true);
  assert(manifest.dsh.client.inject.includes('@deepseek-ai/dsh-client-ui-layout'));
  assert.equal(manifest.exports?.['.'], './index.js');
  assert.equal(manifest.exports?.['./client'], './client.js');
  assert.equal(manifest.exports?.['./locale/*.json'], './locale/*.json');
  assert.equal(manifest.exports?.['./icon'], './icon.svg');
  for (const file of ['package.json', 'index.js', 'client.js', 'cordis.patch.yml', 'icon.svg', 'locale/en.json', 'locale/zh.json']) {
    assert(existsSync(join(base, file)), `${folder}: missing ${file}`);
  }
  for (const locale of ['en', 'zh']) {
    const data = JSON.parse(read(`locale/${locale}.json`));
    assert(data.meta?.title && data.meta?.description, `${folder}: incomplete ${locale} metadata`);
  }
  const patch = read('cordis.patch.yml');
  const nameEntry = /^\s+name:\s*['"]?([^'"\r\n]+)['"]?\s*$/m.exec(patch);
  assert.equal(nameEntry?.[1]?.trim(), manifest.name, `${folder}: patch package name mismatch`);
  const idEntry = /^\s+- id:\s*(.+)\s*$/m.exec(patch);
  assert(idEntry && !seenIds.has(idEntry[1]), `${folder}: duplicate patch id`);
  seenIds.add(idEntry[1]);
  const client = read('client.js');
  assert(client.includes(`id: '${manifest.name}'`), `${folder}: Client module id mismatch`);
  assert(client.includes('ctx.slots.inject'), `${folder}: no slot injection found`);
  for (const file of ['index.js', 'client.js']) {
    assert(!read(file).includes('eval('), `${folder}: unexpected eval in ${file}`);
  }
  console.log(`OK ${folder}: ${manifest.name}@${manifest.version}`);
}
console.log(`Verified ${pluginDirs.length} DSH bundle(s).`);
