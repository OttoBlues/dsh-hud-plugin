import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

for (const channel of ['released', 'unstable']) {
  test(channel + ' starts with no installable versions', () => {
    const manifest = JSON.parse(readFileSync(new URL('../plugins/hud/' + channel + '/index.json', import.meta.url)));
    assert.equal(manifest.schema, 1);
    assert.equal(manifest.channel, channel);
    assert.equal(manifest.package, '@local/dsh-hud');
    assert.equal(manifest.latest, null);
    assert.deepEqual(manifest.releases, []);
  });
}
test('verified archive policy never downloads or packs unreviewed latest source', () => {
  const validator = readFileSync(new URL('../scripts/verify-channels.mjs', import.meta.url), 'utf8');
  assert.match(validator, /for \(const channel of \['released', 'unstable'\]\)/);
  assert.match(validator, /entry\.acceptance\?\.decision, 'approved'/);
  assert.match(validator, /entry\.test\?\.ciRun/);
  assert.match(validator, /createHash\('sha256'\)/);
  assert.doesNotMatch(validator, /npm pack|fetch\(|https:\/\/raw/);
});
