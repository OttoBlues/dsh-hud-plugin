import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const index = JSON.parse(readFileSync(join(root,'plugins/index.json'),'utf8'));
assert.equal(index.schema,1);
assert(Array.isArray(index.components) && index.components.length > 0 && index.components.length <=32);
const dirs=readdirSync(join(root,'plugins')).filter(x=>statSync(join(root,'plugins',x)).isDirectory());
assert.equal(index.components.length,dirs.length,
  'Every component directory must appear in plugins/index.json');
const ids=new Set(),names=new Set();
for(const entry of index.components){
  assert(/^[a-z0-9][a-z0-9-]{0,63}$/.test(entry.id), 'Invalid component id');
  assert(/^@local\/[a-z0-9][a-z0-9-]{0,63}$/.test(entry.name),'Invalid package name');
  assert(typeof entry.title==='string'&&entry.title.length<=90&&entry.title.length>0);
  assert(typeof entry.description==='string'&&entry.description.length<=300);
  assert(dirs.includes(entry.id), 'Unknown or missing component id');
  assert(!ids.has(entry.id)&&!names.has(entry.name),'Duplicate component index entry');
  ids.add(entry.id);names.add(entry.name);
  const pkg=JSON.parse(readFileSync(join(root,'plugins',entry.id,'package.json'),'utf8'));
  assert.equal(entry.name,pkg.name,'Component index and package.json disagree');
}
console.log('Verified '+dirs.length+' repository component(s) are registered.');
