const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { verify } = require('../account-session');

test('legacy credentials select the test player data', async () => {
  assert.deepEqual(await verify('player', 'player'), { role: 'player', playerRole: 'player', environment: 'test' });
  assert.deepEqual(await verify('admin', 'admin'), { role: 'admin', playerRole: 'player', environment: 'test' });
});

test('live credentials select isolated live player data', async () => {
  assert.deepEqual(await verify('player', 'fhQvPmfYdFNZ'), { role: 'player', playerRole: 'player_live', environment: 'live' });
  assert.deepEqual(await verify('admin', 'pIAkBZ-hJKfB'), { role: 'admin', playerRole: 'player_live', environment: 'live' });
});

test('live secrets are not stored as plaintext in the browser bundle', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'account-session.js'), 'utf8');
  assert.doesNotMatch(source, /fhQvPmfYdFNZ|pIAkBZ-hJKfB/);
});
