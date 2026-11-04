/** Validate accepted and test-only release channels without compiling any current source. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve, sep } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const versions = /^\d+\.\d+\.\d+$/;
const sha256 = /^[0-9a-f]{64}$/;
const commit = /^[0-9a-f]{40}$/;
const compare = (a,b) => {
  const left = a.split('.').map(Number);
  const right = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if (left[i] !== right[i]) return left[i] - right[i];
  }
  return 0;
};

let archives = 0;
for (const component of readdirSync(join(root, 'plugins'))) {
  const componentDir = join(root, 'plugins', component);
  if (!statSync(componentDir).isDirectory()) continue;
  const pkg = JSON.parse(readFileSync(join(componentDir, 'package.json'), 'utf8'));

  for (const channel of ['released', 'unstable']) {
    const dir = join(componentDir, channel);
    assert(existsSync(dir), component + ': missing channel ' + channel);
    const idx = JSON.parse(readFileSync(join(dir, 'index.json'), 'utf8'));
    assert.equal(idx.schema, 1);
    assert.equal(idx.component, component);
    assert.equal(idx.package, pkg.name);
    assert.equal(idx.channel, channel);
    assert(Array.isArray(idx.releases) && idx.releases.length <= 128,
      'Release list malformed or too large');
    const names = new Set(['README.md', 'index.json']);
    const seen = new Set();
    for (const entry of idx.releases) {
      const {version, file, sha256: hash, sourceCommit} = entry;
      assert(versions.test(version), 'Invalid release version');
      assert(!seen.has(version), 'Duplicate version in ' + channel);
      seen.add(version);
      const expected = 'v' + version + '/local-dsh-' + component + '-' + version + '.tgz';
      assert.equal(file, expected, 'Only declared tgz archives may be installed');
      assert(sha256.test(hash) && commit.test(sourceCommit), 'Missing integrity and source commit');
      if (channel === 'released') {
        assert(/^U\d{2,3}$/.test(entry.acceptance?.check), 'Stable version requires user acceptance');
        assert(/^\d{4}-\d{2}-\d{2}$/.test(entry.acceptance?.date), 'Stable acceptance date missing');
        assert.equal(entry.acceptance?.decision, 'approved', 'Explicit approval required');
      } else {
        assert(typeof entry.test?.ciRun === 'string' && /^\d+$/.test(entry.test.ciRun),
          'Test version requires a verified CI run');
        assert.equal(entry.test?.result, 'success');
      }
      const archive = resolve(dir, file);
      assert(archive.startsWith(dir + sep), 'Archive escaped release directory');
      assert(existsSync(archive) && statSync(archive).isFile(), 'Declared archive absent');
      assert(statSync(archive).size > 0 && statSync(archive).size <= 25000000,
        'Invalid archive size');
      const digest = createHash('sha256').update(readFileSync(archive)).digest('hex');
      assert.equal(digest, hash, 'Archive hash mismatch');

      const files = execFileSync('tar', ['-tzf', archive],
        {encoding: 'utf8', maxBuffer: 2_000_000}).trim().split(/\r?\n/).filter(Boolean);
      assert(files.length > 0 && files.length <= 500, 'Archive entry count invalid');
      for (const filePath of files) {
        assert(filePath.startsWith('package/') && !filePath.includes('..') &&
               !filePath.includes('\\'), 'Archive path traversal');
      }
      const inside = JSON.parse(execFileSync('tar',
        ['-xOzf', archive, 'package/package.json'],
        {encoding:'utf8', maxBuffer:200_000}));
      assert.equal(inside.name, pkg.name);
      assert.equal(inside.version, version);
      assert.equal(inside.dsh?.bundle?.patch, './cordis.patch.yml');

      const manifest = JSON.parse(readFileSync(join(dir, 'v' + version, 'manifest.json'), 'utf8'));
      for (const key of ['version','sha256','sourceCommit']) {
        assert.equal(manifest[key], entry[key]);
      }
      assert.equal(manifest.channel, channel);
      assert.equal(manifest.package, pkg.name);
      names.add(file);
      names.add('v' + version + '/manifest.json');
      archives++;
    }
    assert.equal(idx.latest, seen.size ? [...seen].sort(compare).at(-1) : null,
      channel + ': latest must match highest advertised version, or null');
    for (const row of readdirSync(dir, {withFileTypes:true})) {
      if (row.isFile()) assert(names.has(row.name), 'Undeclared file in ' + channel);
      else if (row.isDirectory()) {
        assert(/^v\d+\.\d+\.\d+$/.test(row.name), 'Unknown release directory');
        for (const nested of readdirSync(join(dir, row.name))) {
          assert(names.has(row.name + '/' + nested), 'Undeclared release file');
        }
      } else throw new Error('Unknown release entry type');
    }
    console.log(component + '/' + channel + ': ' + seen.size + ' vetted archive(s)');
  }
}
console.log('Validated ' + archives + ' installable archive(s); empty channels are allowed.');
