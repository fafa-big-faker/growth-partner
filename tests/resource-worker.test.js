const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { create, CACHE_NAME } = require('../resource-worker');

const SCOPE = 'https://game.test/growth-partner/';
function fixture(overrides = {}) {
  const cache = new Map(), requests = [];
  const worker = create({ scope: SCOPE, caches: { open: async name => {
    assert.equal(name, CACHE_NAME);
    return { match: async key => cache.get(key)?.clone() };
  } }, fetch: async request => { requests.push(request); return new Response('network'); }, Response, ...overrides });
  function put(relative, content, type = 'audio/wav') {
    const body = Buffer.from(content);
    const url = new URL(relative, SCOPE).href;
    cache.set(url, new Response(body, { headers: { 'content-type': type,
      'x-xianlai-sha256': 'a'.repeat(64), 'x-xianlai-bytes': String(body.length) } }));
    return url;
  }
  return { worker, cache, requests, put };
}

test('worker scope is strictly local runtime media GET; code, configuration, external and reload requests bypass it', () => {
  const f = fixture();
  for (const filename of ['tree.webp?v=one', 'audio/test.wav', 'icon.svg', 'background.avif']) {
    assert.equal(f.worker.accepts(new Request(SCOPE + 'assets/runtime/' + filename)), true);
  }
  for (const request of [new Request(SCOPE), new Request(SCOPE + 'app.js'), new Request(SCOPE + 'game-config.js'),
    new Request(SCOPE + 'assets/runtime/manifest.json'), new Request(SCOPE + 'assets/images/tree.png'),
    new Request('https://other.test/growth-partner/assets/runtime/tree.webp'),
    new Request('https://game.test/outside/assets/runtime/tree.webp'),
    new Request(SCOPE + 'assets/runtime/..%2f..%2faccount.webp'),
    new Request(SCOPE + 'assets/runtime/tree.webp', { method: 'POST' }),
    new Request(SCOPE + 'assets/runtime/tree.webp', { method: 'HEAD' }),
    new Request(SCOPE + 'assets/runtime/tree.webp', { cache: 'reload' })]) {
    assert.equal(f.worker.accepts(request), false, `${request.method} ${request.url}`);
  }
});

test('exact query cache keys and original content types survive full image/audio responses', async () => {
  const f = fixture();
  const image = f.put('assets/runtime/tree.webp?v=one', 'image-data', 'image/webp');
  const response = await f.worker.respond(new Request(image));
  assert.equal(response.status, 200); assert.equal(response.headers.get('content-type'), 'image/webp');
  assert.equal(await response.text(), 'image-data'); assert.equal(f.requests.length, 0);
  assert.equal(await (await f.worker.respond(new Request(image.replace('one', 'two')))).text(), 'network');
  assert.equal(f.requests.length, 1);
});

test('audio ranges return inclusive, open-ended, suffix and clipped 206 responses from complete cached bytes', async () => {
  const f = fixture(), url = f.put('assets/runtime/audio/music.wav?v=2', '0123456789');
  for (const [range, text, contentRange] of [
    ['bytes=2-5', '2345', 'bytes 2-5/10'], ['bytes=7-', '789', 'bytes 7-9/10'],
    ['bytes=-3', '789', 'bytes 7-9/10'], ['bytes=-20', '0123456789', 'bytes 0-9/10'],
    ['bytes=8-99', '89', 'bytes 8-9/10'], ['bytes=0-0', '0', 'bytes 0-0/10'],
  ]) {
    const response = await f.worker.respond(new Request(url, { headers: { range } }));
    assert.equal(response.status, 206); assert.equal(await response.text(), text);
    assert.equal(response.headers.get('content-range'), contentRange);
    assert.equal(response.headers.get('content-length'), String(text.length));
    assert.equal(response.headers.get('content-type'), 'audio/wav');
    assert.equal(response.headers.get('accept-ranges'), 'bytes');
  }
  assert.equal(f.requests.length, 0);
  assert.equal(await (await f.worker.respond(new Request(url))).text(), '0123456789', 'Range never replaces the complete cached file');
});

test('invalid and unsatisfiable audio ranges return empty 416 with the full length', async () => {
  const f = fixture(), url = f.put('assets/runtime/audio/music.wav', '0123456789');
  for (const range of ['bytes=10-', 'bytes=8-2', 'bytes=-0', 'bytes=-', 'bytes=1-2,4-5', 'items=0-2', 'bytes=99999999999999999999-']) {
    const response = await f.worker.respond(new Request(url, { headers: { range } }));
    assert.equal(response.status, 416, range); assert.equal(await response.text(), '');
    assert.equal(response.headers.get('content-range'), 'bytes */10');
    assert.equal(response.headers.get('content-length'), '0');
  }
});

test('a miss, invalid metadata or inaccessible cache falls through to network without caching it', async () => {
  const f = fixture(), url = f.put('assets/runtime/audio/music.wav', 'complete');
  f.cache.get(url).headers.delete('x-xianlai-sha256');
  assert.equal(await (await f.worker.respond(new Request(url))).text(), 'network');
  const fetch = async () => new Response('fallback');
  const worker = create({ scope: SCOPE, caches: { open: async () => { throw new Error('disabled'); } }, fetch, Response });
  assert.equal(await (await worker.respond(new Request(url))).text(), 'fallback');
  assert.equal(f.cache.size, 1);
});

test('stalled cache open, match and audio body reads have a finite network fallback', async () => {
  const stalled = () => new Promise(() => {});
  const headers = new Headers({ 'x-xianlai-sha256': 'a'.repeat(64), 'x-xianlai-bytes': '10' });
  for (const operation of ['open', 'match', 'arrayBuffer']) {
    const cache = { match: operation === 'match' ? stalled : async () => ({ status: 200, headers, arrayBuffer: stalled }) };
    const f = fixture({ cacheTimeoutMs: 5, caches: { open: operation === 'open' ? stalled : async () => cache } });
    const response = await f.worker.respond(new Request(SCOPE + 'assets/runtime/audio/stalled.wav', { headers: { range: 'bytes=0-1' } }));
    assert.equal(await response.text(), 'network', operation); assert.equal(f.requests.length, 1);
  }
});

test('cache bypass is restricted to the notifying project client and sends no cached data', async () => {
  const f = fixture(), url = f.put('assets/runtime/tree.webp', 'cached', 'image/webp');
  const notify = (id, sourceUrl, type = 'xianlai-resource-pack:bypass-cache') => f.worker.receiveMessage({ data: { type }, source: { id, url: sourceUrl } });
  notify('outside', 'https://other.test/growth-partner/');
  notify('different-project', 'https://game.test/other/');
  notify('wrong-type', SCOPE, 'anything-else');
  for (const id of ['outside', 'different-project', 'wrong-type', 'other-client']) {
    assert.equal(await (await f.worker.respond(new Request(url), id)).text(), 'cached');
  }
  notify('fallback-client', SCOPE + 'index.html');
  assert.equal(await (await f.worker.respond(new Request(url), 'fallback-client')).text(), 'network');
  assert.equal(await (await f.worker.respond(new Request(url), 'other-client')).text(), 'cached');
  assert.equal(f.requests.length, 1);
});

test('install claims the current project without importing manifests or caching application/account traffic', async () => {
  const handlers = new Map(), calls = [];
  const worker = { registration: { scope: SCOPE }, caches: { open: async () => ({ match: async () => null }) },
    fetch: async () => new Response('network'), Response, setTimeout, clearTimeout,
    addEventListener: (name, callback) => handlers.set(name, callback),
    skipWaiting: async () => calls.push('skip'), clients: { claim: async () => calls.push('claim') } };
  const source = fs.readFileSync(path.join(__dirname, '..', 'resource-worker.js'), 'utf8');
  vm.runInNewContext(source, { self: worker, URL, Headers, Uint8Array, Number });
  const waits = [];
  handlers.get('install')({ waitUntil: promise => waits.push(promise) });
  handlers.get('activate')({ waitUntil: promise => waits.push(promise) });
  await Promise.all(waits); assert.deepEqual(calls, ['skip', 'claim']);
  let intercepted = false;
  handlers.get('fetch')({ request: new Request(SCOPE + 'app.js'), respondWith() { intercepted = true; } });
  assert.equal(intercepted, false);
  handlers.get('fetch')({ request: new Request(SCOPE + 'assets/runtime/tree.webp', { cache: 'reload' }), respondWith() { intercepted = true; } });
  assert.equal(intercepted, false);
  assert.doesNotMatch(source, /importScripts|BootAssetManifest|cache\.put|indexedDB/);
});
