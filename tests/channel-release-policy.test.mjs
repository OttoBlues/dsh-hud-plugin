import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// This test must continue to pass after a *user-approved* stable or unstable
// release is added. The archive validator checks accepted artifacts separately.
for (const channel of ['released', 'unstable']) {
  test(channel + ' has a correctly shaped independent channel index', () => {
    const index = JSON.parse(readFileSync(
      new URL('../plugins/hud/' + channel + '/index.json', import.meta.url),
    ));
    assert.equal(index.schema, 1);
    assert.equal(index.component, 'hud');
    assert.equal(index.channel, channel);
    assert.equal(index.package, '@local/dsh-hud');
    assert.ok(Array.isArray(index.releases));
    if (index.releases.length === 0) {
      assert.equal(index.latest, null);
    } else {
      assert.ok(index.releases.some(entry => entry.version === index.latest));
    }
  });
}

test('archive verifier requires approval evidence and validates package bytes', () => {
  const validator = readFileSync(
    new URL('../scripts/verify-channels.mjs', import.meta.url), 'utf8');
  assert.match(validator, /for \(const channel of \['released', 'unstable'\]\)/);
  assert.match(validator, /entry\.acceptance\?\.decision, 'approved'/);
  assert.match(validator, /entry\.test\?\.ciRun/);
  assert.match(validator, /createHash\('sha256'\)/);
  assert.doesNotMatch(validator, /npm pack|fetch\(|https:\/\/raw/);
});
