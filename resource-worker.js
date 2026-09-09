(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else {
    const worker = api.create({ scope: root.registration.scope, caches: root.caches,
      fetch: root.fetch.bind(root), Response: root.Response,
      setTimeout: root.setTimeout.bind(root), clearTimeout: root.clearTimeout.bind(root) });
    root.addEventListener('install', event => event.waitUntil(root.skipWaiting()));
    root.addEventListener('activate', event => event.waitUntil(root.clients.claim()));
    root.addEventListener('fetch', event => {
      if (worker.accepts(event.request)) event.respondWith(worker.respond(event.request, event.clientId));
    });
    root.addEventListener('message', event => worker.receiveMessage(event));
  }
})(typeof self === 'undefined' ? globalThis : self, function () {
  'use strict';
  const CACHE_NAME = 'xianlai-resource-pack-v1';
  const MEDIA = /\.(?:png|jpe?g|gif|webp|avif|svg|ico|wav|mp3|ogg|m4a|aac|flac|opus)$/i;
  const AUDIO = /\.(?:wav|mp3|ogg|m4a|aac|flac|opus)$/i;

  function create({ scope, caches, fetch, Response: ResponseType = Response,
    setTimeout: schedule = setTimeout, clearTimeout: cancelSchedule = clearTimeout, cacheTimeoutMs = 1500 } = {}) {
    const base = new URL(scope);
    const bypassedClients = new Set();
    function receiveMessage(event) {
      if (event.data?.type !== 'xianlai-resource-pack:bypass-cache' || !event.source?.id) return;
      try {
        const source = new URL(event.source.url);
        if (source.origin === base.origin && source.pathname.startsWith(base.pathname)) bypassedClients.add(event.source.id);
      } catch { /* Only a client in this project can change its own cache mode. */ }
    }
    function boundedCache(operation) {
      return new Promise((resolve, reject) => {
        const timer = schedule(() => reject(new Error('Resource cache timed out')), Math.max(1, Number(cacheTimeoutMs) || 1500));
        Promise.resolve().then(operation).then(value => { cancelSchedule(timer); resolve(value); },
          error => { cancelSchedule(timer); reject(error); });
      });
    }
    function accepts(request) {
      if (request.method !== 'GET' || request.cache === 'reload') return false;
      try {
        const url = new URL(request.url);
        return url.origin === base.origin && url.pathname.startsWith(base.pathname + 'assets/runtime/')
          && !/%(?:2f|5c)/i.test(url.pathname) && MEDIA.test(url.pathname);
      } catch { return false; }
    }

    async function respond(request, clientId = '') {
      if (!accepts(request) || bypassedClients.has(clientId)) return fetch(request);
      let cached;
      try { cached = await boundedCache(async () => (await caches.open(CACHE_NAME)).match(request.url)); }
      catch { return fetch(request); }
      if (cached?.status !== 200 || !/^[a-f0-9]{64}$/.test(cached.headers.get('x-xianlai-sha256') || '')
          || !/^[1-9]\d*$/.test(cached.headers.get('x-xianlai-bytes') || '')) return fetch(request);
      const range = request.headers.get('range');
      if (!range || !AUDIO.test(new URL(request.url).pathname)) return cached;
      let bytes;
      try { bytes = new Uint8Array(await boundedCache(() => cached.arrayBuffer())); }
      catch { return fetch(request); }
      const total = bytes.byteLength;
      if (total !== Number(cached.headers.get('x-xianlai-bytes'))) return fetch(request);
      const headers = new Headers(cached.headers);
      headers.set('accept-ranges', 'bytes');
      headers.delete('content-encoding'); headers.delete('transfer-encoding');
      const match = /^bytes=(\d*)-(\d*)$/i.exec(range.trim());
      let start = NaN, end = NaN;
      if (match && (match[1] || match[2])) {
        if (match[1]) {
          start = Number(match[1]); end = match[2] ? Number(match[2]) : total - 1;
        } else {
          const suffix = Number(match[2]);
          if (Number.isSafeInteger(suffix) && suffix > 0) { start = Math.max(0, total - suffix); end = total - 1; }
        }
      }
      if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || start >= total || end < start) {
        headers.set('content-range', `bytes */${total}`); headers.set('content-length', '0');
        return new ResponseType(null, { status: 416, statusText: 'Range Not Satisfiable', headers });
      }
      end = Math.min(end, total - 1);
      headers.set('content-range', `bytes ${start}-${end}/${total}`);
      headers.set('content-length', String(end - start + 1));
      return new ResponseType(bytes.slice(start, end + 1), { status: 206, statusText: 'Partial Content', headers });
    }

    return { accepts, respond, receiveMessage };
  }
  return { create, CACHE_NAME };
});
