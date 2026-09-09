const test = require('node:test');
const assert = require('node:assert/strict');
const { createHash, webcrypto } = require('node:crypto');
const { create, CACHE_NAME, WORKER_FILE, sha256Fallback } = require('../resource-pack');

const BASE = 'https://game.test/growth-partner/';
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const settle = () => new Promise(resolve => setImmediate(resolve));
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
function descriptor(name, content = name, density = 'all') {
  const data = Buffer.from(content);
  return { asset: { url: `assets/runtime/${name}`, bytes: data.length, sha256: digest(data),
    kind: name.endsWith('.wav') ? 'audio' : 'image', density }, data };
}
class MemoryCache {
  constructor() { this.entries = new Map(); this.writes = []; this.deleted = []; }
  async match(key) { return this.entries.get(typeof key === 'string' ? key : key.url)?.clone(); }
  async put(key, response) { this.writes.push(key); this.entries.set(key, response.clone()); }
  async keys() { return [...this.entries.keys()].map(url => new Request(url)); }
  async delete(key) { const url = typeof key === 'string' ? key : key.url; this.deleted.push(url); return this.entries.delete(url); }
}
function cached(file) {
  return new Response(file.data, { headers: { 'content-type': file.asset.kind === 'audio' ? 'audio/wav' : 'image/webp',
    'x-xianlai-sha256': file.asset.sha256, 'x-xianlai-bytes': String(file.asset.bytes) } });
}
function fixture(files, overrides = {}) {
  const cache = new MemoryCache(), requests = [], registrations = [], listeners = new Set(), workerMessages = [];
  const storage = { open: async name => { assert.equal(name, CACHE_NAME); return cache; } };
  const worker = {
    controller: { scriptURL: new URL(WORKER_FILE, BASE).href, postMessage: message => workerMessages.push(message) },
    async register(url, options) { registrations.push({ url, options }); return {}; },
    addEventListener(name, fn) { assert.equal(name, 'controllerchange'); listeners.add(fn); },
    removeEventListener(name, fn) { listeners.delete(fn); },
  };
  const data = new Map(files.map(file => [new URL(file.asset.url, BASE).href, file.data]));
  const fetch = async (url, options) => {
    requests.push({ url, options });
    if (!data.has(url)) return new Response('', { status: 404 });
    return new Response(data.get(url));
  };
  const dependencies = { baseUrl: BASE, caches: storage, serviceWorker: worker, crypto: null,
    fetch, workerTimeoutMs: 20, timeoutMs: 500, ...overrides };
  const pack = create(dependencies);
  return { pack, cache, requests, registrations, worker, listeners, workerMessages, data, dependencies,
    manifest: { version: 'fixture-v1', assets: files.map(file => file.asset) } };
}

test('cold preparation verifies complete bytes, caches actual query URLs, and waits for control before 100%', async () => {
  const files = [descriptor('ui/paper.webp?v=one', 'paper'), descriptor('audio/test.wav', 'complete audio')];
  // Query strings are retained, while kind comes from the actual path extension.
  files[0].asset.kind = 'image';
  const f = fixture(files), progress = [];
  const result = await f.pack.prepare(f.manifest, value => progress.push(value));
  assert.equal(result.ready, true); assert.equal(result.persistent, true);
  assert.equal(result.loadedBytes, files.reduce((sum, file) => sum + file.data.length, 0));
  assert.equal(result.totalBytes, result.loadedBytes);
  assert.deepEqual(result.failed, []); assert.deepEqual(result.cancelled, []);
  assert.equal(f.cache.entries.size, 2); assert.equal(f.pack.isReady(), true);
  for (const request of f.requests) {
    assert.equal(request.options.cache, 'reload'); assert.equal(request.options.method, 'GET');
    assert.equal(request.options.redirect, 'error');
  }
  for (const file of files) {
    const response = await f.cache.match(new URL(file.asset.url, BASE).href);
    assert.equal(response.headers.get('x-xianlai-sha256'), file.asset.sha256);
    assert.equal(response.headers.get('x-xianlai-bytes'), String(file.asset.bytes));
    assert.deepEqual(Buffer.from(await response.arrayBuffer()), file.data);
  }
  assert.equal(progress.at(-1).percent, 100);
  assert.ok(progress.slice(0, -1).every(value => value.percent <= 99));
  assert.deepEqual(f.registrations, [{ url: new URL(WORKER_FILE, BASE).href,
    options: { scope: BASE, updateViaCache: 'none' } }]);
});

test('hot manifest changes reuse matching cache entries; only changed or evicted files download', async () => {
  const files = [descriptor('one.webp', 'first'), descriptor('two.webp', 'second')], f = fixture(files);
  await f.pack.prepare(f.manifest);
  const hot = create(f.dependencies);
  await hot.prepare({ ...f.manifest, version: 'different-manifest-version' });
  assert.equal(f.requests.length, 2);
  const changed = descriptor('two.webp', 'changed bytes');
  f.data.set(new URL(changed.asset.url, BASE).href, changed.data);
  await hot.prepare({ version: 'changed', assets: [files[0].asset, changed.asset] });
  assert.equal(f.requests.length, 3);
  await f.cache.delete(new URL(files[0].asset.url, BASE).href);
  await hot.prepare({ version: 'changed', assets: [files[0].asset, changed.asset] });
  assert.equal(f.requests.length, 4, 'memory hints do not hide eviction from persistent storage');
  const response = await f.cache.match(new URL(changed.asset.url, BASE).href);
  assert.equal(response.headers.get('x-xianlai-sha256'), changed.asset.sha256);
});

test('invalid cached metadata triggers a verified reload rather than a false hot hit', async () => {
  const file = descriptor('tree.webp'), f = fixture([file]);
  const stale = cached(file);
  stale.headers.set('x-xianlai-bytes', '999');
  await f.cache.put(new URL(file.asset.url, BASE).href, stale);
  assert.equal((await f.pack.prepare(f.manifest)).ready, true);
  assert.equal(f.requests.length, 1);
});

test('DPR selects exactly one tree density; successful cleanup preserves the other density in this manifest', async () => {
  const common = descriptor('common.webp'), normal = descriptor('tree.webp', 'normal', 1), hd = descriptor('tree@2x.webp', 'large', 2);
  for (const dpr of [1, 2, 3, 4]) {
    const f = fixture([common, normal, hd]);
    const unused = dpr > 1 ? normal : hd;
    await f.cache.put(new URL(unused.asset.url, BASE).href, cached(unused));
    const obsolete = descriptor('old.webp');
    await f.cache.put(new URL(obsolete.asset.url, BASE).href, cached(obsolete));
    const result = await f.pack.prepare(f.manifest, undefined, { dpr });
    assert.equal(result.ready, true);
    assert.equal(result.totalBytes, common.asset.bytes + (dpr > 1 ? hd.asset.bytes : normal.asset.bytes));
    assert.equal(f.requests.length, 2);
    assert.ok(f.requests.some(request => request.url.endsWith(dpr > 1 ? 'tree@2x.webp' : 'tree.webp')));
    assert.equal(f.cache.entries.has(new URL(unused.asset.url, BASE).href), true);
    assert.equal(f.cache.entries.has(new URL(obsolete.asset.url, BASE).href), false);
  }
});

test('wrong byte lengths, wrong SHA and partial responses never count as complete or enter cache', async () => {
  const file = descriptor('image.webp', '123456');
  for (const response of [new Response('12'), new Response('123456789'), new Response('abcdef'), new Response('123456', { status: 206 })]) {
    const f = fixture([file], { fetch: async () => response });
    const progress = [];
    const result = await f.pack.prepare(f.manifest, value => progress.push(value));
    assert.equal(result.ready, false); assert.deepEqual(result.failed, [file.asset.url]);
    assert.equal(result.loadedBytes, 0); assert.equal(f.cache.entries.size, 0);
    assert.ok(progress.every(value => value.percent < 100));
  }
});

test('stream progress counts actual received bytes and cannot reach 100 while SHA verification is pending', async () => {
  const file = descriptor('audio/music.wav', '12345678'), verification = deferred();
  let stream;
  const f = fixture([file], {
    crypto: { subtle: { digest: () => verification.promise } },
    fetch: async () => new Response(new ReadableStream({ start(controller) { stream = controller; } })),
  });
  const progress = [], preparation = f.pack.prepare(f.manifest, value => progress.push(value));
  await settle(); stream.enqueue(file.data.subarray(0, 4)); await settle();
  assert.equal(progress.at(-1).loadedBytes, 4); assert.equal(progress.at(-1).percent, 50);
  stream.enqueue(file.data.subarray(4)); stream.close(); await settle();
  assert.equal(progress.at(-1).loadedBytes, 8); assert.equal(progress.at(-1).percent, 99);
  assert.equal(progress.at(-1).completed, 0); assert.equal(f.pack.isReady(), false);
  verification.resolve(Buffer.from(file.asset.sha256, 'hex'));
  assert.equal((await preparation).ready, true);
});

test('retry downloads only failed files and retains already verified successes', async () => {
  const one = descriptor('one.webp'), two = descriptor('two.webp'), f = fixture([one, two]);
  f.data.delete(new URL(two.asset.url, BASE).href);
  const failed = await f.pack.prepare(f.manifest);
  assert.deepEqual(failed.failed, [two.asset.url]); assert.equal(failed.loadedBytes, one.asset.bytes);
  f.data.set(new URL(two.asset.url, BASE).href, two.data);
  assert.equal((await f.pack.prepare(f.manifest)).ready, true);
  assert.equal(f.requests.length, 3);
  assert.equal(f.requests.filter(request => request.url.endsWith('one.webp')).length, 1);
});

test('concurrent consumers share downloads and cancelling one never aborts another', async () => {
  const file = descriptor('shared.webp'), gate = deferred(), requests = [];
  const f = fixture([file], { fetch: async (url, options) => { requests.push(options); await gate.promise; return new Response(file.data); } });
  const firstSignal = new AbortController(), progress = [];
  const first = f.pack.prepare(f.manifest, value => progress.push(value), { signal: firstSignal.signal });
  const second = f.pack.prepare(f.manifest);
  await settle(); assert.equal(requests.length, 1);
  firstSignal.abort();
  assert.equal((await first).ready, false); assert.equal(requests[0].signal.aborted, false);
  const oldReports = progress.length;
  gate.resolve(); assert.equal((await second).ready, true);
  assert.equal(progress.length, oldReports); assert.equal(f.pack.isReady(), true);
});

test('the last cancellation aborts a shared fetch and late bytes cannot write cache or newer run state', async () => {
  const file = descriptor('cancel.webp'), gate = deferred(); let firstSignal, calls = 0;
  const f = fixture([file], { fetch: async (url, options) => {
    calls++; if (calls === 1) { firstSignal = options.signal; await gate.promise; } return new Response(file.data);
  } });
  const signal = new AbortController(), first = f.pack.prepare(f.manifest, undefined, { signal: signal.signal });
  await settle(); signal.abort();
  const cancelled = await first;
  assert.deepEqual(cancelled.cancelled, [file.asset.url]); assert.equal(firstSignal.aborted, true);
  assert.equal((await f.pack.prepare(f.manifest)).ready, true);
  const writes = f.cache.writes.length;
  gate.resolve(); await settle();
  assert.equal(f.cache.writes.length, writes); assert.equal(f.pack.isReady(), true);
});

test('a late old-manifest download cannot overwrite a newer hash at the same unversioned URL', async () => {
  const old = descriptor('mutable.webp', 'old'), updated = descriptor('mutable.webp', 'new content'), gate = deferred();
  let calls = 0;
  const f = fixture([old], { fetch: async () => { if (++calls === 1) { await gate.promise; return new Response(old.data); } return new Response(updated.data); } });
  const first = f.pack.prepare(f.manifest); await settle();
  const next = await f.pack.prepare({ version: 'new', assets: [updated.asset] });
  assert.equal(next.ready, true);
  gate.resolve(); await first;
  const response = await f.cache.match(new URL(old.asset.url, BASE).href);
  assert.equal(response.headers.get('x-xianlai-sha256'), updated.asset.sha256);
  assert.equal(f.pack.getState().totalBytes, updated.asset.bytes);
});

test('network work is capped at six and queued files start only as a slot becomes available', async () => {
  const files = Array.from({ length: 9 }, (_, n) => descriptor(`${n}.webp`)), gates = [], starts = [];
  const f = fixture(files, { fetch: async url => {
    const gate = deferred(); gates.push(gate); starts.push(url); await gate.promise;
    return new Response(files.find(file => new URL(file.asset.url, BASE).href === url).data);
  } });
  const pending = f.pack.prepare(f.manifest); await settle();
  assert.equal(starts.length, 6);
  gates[0].resolve(); await settle(); await settle();
  assert.equal(starts.length, 7);
  gates.slice(1).forEach(gate => gate.resolve()); await settle(); await settle();
  gates.forEach(gate => gate.resolve());
  assert.equal((await pending).ready, true); assert.equal(starts.length, 9);
});

test('unavailable caches and quota failures fall back without losing verified retry progress', async () => {
  const file = descriptor('fallback.webp');
  for (const mode of ['missing', 'open', 'write']) {
    const overrides = mode === 'missing' ? { caches: null, serviceWorker: null }
      : mode === 'open' ? { caches: { open: async () => { throw new Error('unavailable'); } } } : {};
    const f = fixture([file], overrides);
    if (mode === 'write') f.cache.put = async () => { throw new Error('quota'); };
    const result = await f.pack.prepare(f.manifest);
    assert.equal(result.ready, true); assert.equal(result.persistent, false);
    assert.equal((await f.pack.prepare(f.manifest)).ready, true);
    assert.equal(f.requests.length, 1);
  }
});

test('worker first takeover is bounded and unsupported/refused registration does not block entry', async () => {
  const file = descriptor('worker.webp');
  const f = fixture([file]); f.worker.controller = null;
  const progress = [], pending = f.pack.prepare(f.manifest, value => progress.push(value)); await settle();
  assert.ok(progress.some(value => value.ok && !value.persistent), 'verified bytes can finish before control');
  f.worker.controller = { scriptURL: new URL(WORKER_FILE, BASE).href };
  [...f.listeners].forEach(listener => listener());
  assert.equal((await pending).persistent, true); assert.equal(f.listeners.size, 1, 'only the fallback controller listener remains');
  assert.ok(progress.some(value => value.persistent && !value.ready), 'control is reported before final entry readiness');
  for (const serviceWorker of [null, { register: async () => { throw new Error('denied'); } }, { register: () => new Promise(() => {}) }]) {
    const fallback = fixture([file], { serviceWorker, workerTimeoutMs: 5 });
    const result = await fallback.pack.prepare(fallback.manifest);
    assert.equal(result.ready, true); assert.equal(result.persistent, false);
  }
});

test('a browser that leaves CacheStorage opening unresolved still prepares over HTTP', async () => {
  const file = descriptor('stalled-cache.webp');
  const f = fixture([file], { caches: { open: () => new Promise(() => {}) }, cacheTimeoutMs: 5 });
  const result = await f.pack.prepare(f.manifest);
  assert.equal(result.ready, true); assert.equal(result.persistent, false);
  assert.equal(f.requests.length, 1);
});

test('stalled cache reads and writes fall back to verified HTTP and retain successes on retry', async () => {
  const file = descriptor('stalled-cache.webp');
  for (const operation of ['match', 'put']) {
    const f = fixture([file], { cacheTimeoutMs: 5 });
    f.cache[operation] = () => new Promise(() => {});
    const result = await f.pack.prepare(f.manifest);
    assert.equal(result.ready, true, operation); assert.equal(result.persistent, false, operation);
    assert.equal((await f.pack.prepare(f.manifest)).ready, true);
    assert.equal(f.requests.length, 1, operation);
    assert.deepEqual(f.workerMessages.at(-1), { type: 'xianlai-resource-pack:bypass-cache' });
  }
});

test('one cleanup deadline bounds stalled key enumeration and stops a late deletion sweep', async () => {
  const file = descriptor('keep.webp');
  for (const operation of ['keys', 'delete']) {
    const f = fixture([file], { cacheTimeoutMs: 5 }), gate = deferred();
    const original = f.cache[operation].bind(f.cache);
    const obsolete = [descriptor('old-one.webp'), descriptor('old-two.webp')];
    for (const entry of obsolete) await f.cache.put(new URL(entry.asset.url, BASE).href, cached(entry));
    let calls = 0;
    f.cache[operation] = async (...args) => { calls++; await gate.promise; return original(...args); };
    const result = await f.pack.prepare(f.manifest);
    assert.equal(result.ready, true, operation); assert.equal(result.persistent, true, operation);
    assert.equal(calls, 1);
    gate.resolve(); await settle(); await settle();
    assert.equal(calls, 1, 'a timed out sweep starts no further storage operations');
    assert.equal(f.cache.entries.has(new URL(file.asset.url, BASE).href), true);
    assert.equal(f.cache.entries.has(new URL(obsolete[1].asset.url, BASE).href), true);
  }
});

test('an uncancellable late put cannot race a new write or change the current HTTP fallback state', async () => {
  const old = descriptor('late-write.webp', 'old'), updated = descriptor('late-write.webp', 'newer content');
  const f = fixture([old], { cacheTimeoutMs: 5 }), gate = deferred(), originalPut = f.cache.put.bind(f.cache);
  let puts = 0;
  f.cache.put = async (...args) => { puts++; await gate.promise; return originalPut(...args); };
  assert.equal((await f.pack.prepare(f.manifest)).persistent, false);
  f.data.set(new URL(updated.asset.url, BASE).href, updated.data);
  const current = await f.pack.prepare({ version: 'updated', assets: [updated.asset] });
  assert.equal(current.ready, true); assert.equal(current.persistent, false);
  assert.equal(puts, 1); assert.equal(f.requests.length, 2);
  gate.resolve(); await settle(); await settle();
  assert.equal(puts, 1); assert.equal(f.pack.getState().totalBytes, updated.asset.bytes);
  assert.equal(f.pack.isReady(), true);
  assert.deepEqual(f.workerMessages.at(-1), { type: 'xianlai-resource-pack:bypass-cache' });
  const lateControllerMessages = [];
  f.worker.controller = { scriptURL: new URL(WORKER_FILE, BASE).href, postMessage: message => lateControllerMessages.push(message) };
  [...f.listeners].forEach(listener => listener());
  assert.deepEqual(lateControllerMessages, [{ type: 'xianlai-resource-pack:bypass-cache' }]);
});

test('cancellation during worker takeover resolves promptly and releases the consumer', async () => {
  const file = descriptor('worker-cancel.webp'), f = fixture([file], { serviceWorker: { register: () => new Promise(() => {}) }, workerTimeoutMs: 40 });
  const signal = new AbortController(), preparation = f.pack.prepare(f.manifest, undefined, { signal: signal.signal });
  await settle(); await settle(); signal.abort();
  const result = await preparation;
  assert.equal(result.ready, false); assert.equal(result.persistent, false);
});

test('unsafe resources are rejected before fetch and no account/configuration/third-party request is permitted', async () => {
  const file = descriptor('safe.webp');
  for (const url of ['app.js', 'game-config.js', 'assets/runtime/code.js', '../assets/runtime/outside.webp',
    'https://third.test/file.webp', 'https://game.test/other/assets/runtime/image.webp', 'assets/runtime/image.webp#fragment',
    'assets/runtime/..%2f..%2faccount.webp']) {
    const f = fixture([file]);
    await assert.rejects(f.pack.prepare({ version: 'bad', assets: [{ ...file.asset, url }] }), /Invalid static/);
    assert.equal(f.requests.length, 0); assert.equal(f.registrations.length, 0);
  }
});

test('SHA-256 fallback and native verification agree for known and multiblock inputs', async () => {
  for (const text of ['', 'abc', 'x'.repeat(56), 'x'.repeat(64), 'hello '.repeat(120)]) {
    const bytes = Buffer.from(text); assert.equal(sha256Fallback(bytes), digest(bytes));
  }
  const file = descriptor('native.webp', 'Web Crypto fixture'), f = fixture([file], { crypto: webcrypto });
  assert.equal((await f.pack.prepare(f.manifest)).ready, true);
});
