const test = require('node:test');
const assert = require('node:assert/strict');
const { create } = require('../login-credentials');

function input(value = '') {
  const listeners = {};
  return { value, addEventListener(type, fn) { listeners[type] = fn; },
    type(value) { this.value = value; listeners.input?.(); } };
}

function setup(overrides = {}) {
  const usernameInput = input();
  const passwordInput = input();
  const stored = [];
  const requested = [];
  const credentials = {
    async get(options) { requested.push(options); return null; },
    async store(credential) { stored.push(credential); return credential; },
  };
  class PasswordCredential {
    constructor(data) { Object.assign(this, data); this.type = 'password'; }
  }
  const controller = create({ usernameInput, passwordInput, credentials,
    PasswordCredential, isSecureContext: true, ...overrides });
  return { controller, usernameInput, passwordInput, stored, requested };
}

test('silent restoration fills only the selected role and never logs in', async () => {
  let options;
  const state = setup({ credentials: { async get(request) {
    options = request;
    return { type: 'password', id: 'player', password: 'fixture-player-secret' };
  } } });
  assert.equal(await state.controller.selectRole('player'), true);
  assert.equal(state.usernameInput.value, 'player');
  assert.equal(state.passwordInput.value, 'fixture-player-secret');
  assert.deepEqual(options, { password: true, mediation: 'silent' });
});

test('switching role clears the previous password and rejects another role credential', async () => {
  const state = setup({ credentials: { async get() {
    return { type: 'password', id: 'player', password: 'fixture-player-secret' };
  } } });
  await state.controller.selectRole('player');
  assert.equal(await state.controller.selectRole('admin'), false);
  assert.equal(state.usernameInput.value, 'admin');
  assert.equal(state.passwordInput.value, '');
});

test('late restoration cannot overwrite a typed password', async () => {
  let resolve;
  const state = setup({ credentials: { get: () => new Promise(done => { resolve = done; }) } });
  const request = state.controller.selectRole('player');
  state.passwordInput.type('manually-entered-fixture');
  resolve({ type: 'password', id: 'player', password: 'old-fixture' });
  assert.equal(await request, false);
  assert.equal(state.passwordInput.value, 'manually-entered-fixture');
});

test('late restoration cannot refill after a role switch or explicit clearing', async () => {
  const pending = [];
  const state = setup({ credentials: { get: () => new Promise(resolve => pending.push(resolve)) } });
  const first = state.controller.selectRole('player');
  const second = state.controller.selectRole('admin');
  pending[0]({ type: 'password', id: 'player', password: 'fixture-player' });
  state.controller.clear();
  pending[1]({ type: 'password', id: 'admin', password: 'fixture-admin' });
  assert.deepEqual(await Promise.all([first, second]), [false, false]);
  assert.equal(state.passwordInput.value, '');
});

test('unsupported browsers retain manual login without a web-storage password fallback', async () => {
  const state = setup({ credentials: undefined, PasswordCredential: undefined });
  assert.equal(await state.controller.selectRole('player'), false);
  state.passwordInput.type('fixture-manual');
  assert.equal(state.controller.readPassword('player'), 'fixture-manual');
  assert.equal(await state.controller.saveVerified('player', 'fixture-manual'), false);
});

test('browser rejection of restore or save does not break manual login', async () => {
  const state = setup({ credentials: {
    async get() { throw new Error('denied'); },
    async store() { throw new Error('denied'); },
  } });
  assert.equal(await state.controller.selectRole('admin'), false);
  state.passwordInput.type('fixture-manual');
  assert.equal(await state.controller.saveVerified('admin', 'fixture-manual'), false);
  assert.equal(state.controller.readPassword('admin'), 'fixture-manual');
});

test('verified passwords use the native manager with stable, separate role ids', async () => {
  const state = setup();
  assert.equal(await state.controller.saveVerified('player', 'fixture-player'), true);
  assert.equal(await state.controller.saveVerified('admin', 'fixture-admin'), true);
  assert.deepEqual(state.stored.map(({ id, password }) => ({ id, password })), [
    { id: 'player', password: 'fixture-player' },
    { id: 'admin', password: 'fixture-admin' },
  ]);
  assert.equal(await state.controller.saveVerified('other-role', 'fixture'), false);
  assert.equal(await state.controller.saveVerified('player', ''), false);
});

test('unexpected native username autofill is not submitted under another role', async () => {
  const state = setup();
  await state.controller.selectRole('player');
  state.usernameInput.value = 'admin';
  state.passwordInput.value = 'fixture-admin';
  assert.equal(state.controller.readPassword('player'), '');
  assert.equal(state.usernameInput.value, 'player');
  assert.equal(state.passwordInput.value, '');
});

test('insecure contexts do not attempt native credential access', async () => {
  const state = setup({ isSecureContext: false });
  await state.controller.selectRole('player');
  await state.controller.saveVerified('player', 'fixture-player');
  assert.equal(state.requested.length, 0);
  assert.equal(state.stored.length, 0);
});
