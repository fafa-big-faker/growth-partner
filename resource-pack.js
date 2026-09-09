(function (root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ResourcePack = api.create();
})(typeof globalThis === 'undefined' ? window : globalThis, function (root) {
  'use strict';

  const CACHE_NAME = 'xianlai-resource-pack-v1';
  const WORKER_FILE = 'resource-worker.js?v=entry-preparation-20260910';
  const IMAGE = /\.(?:png|jpe?g|gif|webp|avif|svg|ico)$/i;
  const AUDIO = /\.(?:wav|mp3|ogg|m4a|aac|flac|opus)$/i;
  const MIME = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp',
    avif: 'image/avif', svg: 'image/svg+xml', ico: 'image/x-icon', wav: 'audio/wav', mp3: 'audio/mpeg',
    ogg: 'audio/ogg', m4a: 'audio/mp4', aac: 'audio/aac', flac: 'audio/flac', opus: 'audio/ogg' };
  const own = (object, key, fallback) => Object.prototype.hasOwnProperty.call(object, key) ? object[key] : fallback;

  // Secure contexts use Web Crypto. The same SHA-256 calculation keeps an
  // ordinary HTTP/cache-unavailable fallback verifiable without a dependency.
  function sha256Fallback(bytes) {
    const constants = [0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
      0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
      0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
      0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
      0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
      0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
      0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
      0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];
    const data = new Uint8Array(Math.ceil((bytes.length + 9) / 64) * 64);
    data.set(bytes); data[bytes.length] = 128;
    const view = new DataView(data.buffer), bits = bytes.length * 8;
    view.setUint32(data.length - 8, Math.floor(bits / 4294967296));
    view.setUint32(data.length - 4, bits >>> 0);
    const hash = [0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];
    const words = new Uint32Array(64), rotate = (value, count) => (value >>> count) | (value << (32 - count));
    for (let offset = 0; offset < data.length; offset += 64) {
      for (let i = 0; i < 16; i++) words[i] = view.getUint32(offset + i * 4);
      for (let i = 16; i < 64; i++) {
        const a = words[i - 15], b = words[i - 2];
        words[i] = words[i - 16] + (rotate(a, 7) ^ rotate(a, 18) ^ (a >>> 3))
          + words[i - 7] + (rotate(b, 17) ^ rotate(b, 19) ^ (b >>> 10));
      }
      let [a,b,c,d,e,f,g,h] = hash;
      for (let i = 0; i < 64; i++) {
        const first = (h + (rotate(e, 6) ^ rotate(e, 11) ^ rotate(e, 25))
          + ((e & f) ^ (~e & g)) + constants[i] + words[i]) >>> 0;
        const second = ((rotate(a, 2) ^ rotate(a, 13) ^ rotate(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) >>> 0;
        h = g; g = f; f = e; e = (d + first) >>> 0; d = c; c = b; b = a; a = (first + second) >>> 0;
      }
      [a,b,c,d,e,f,g,h].forEach((value, i) => { hash[i] = (hash[i] + value) >>> 0; });
    }
    return hash.map(value => value.toString(16).padStart(8, '0')).join('');
  }

  function create(dependencies = {}) {
    const host = dependencies.window || root;
    const base = new URL('.', dependencies.baseUrl || host.document?.currentScript?.src
      || host.document?.baseURI || host.location?.href || 'http://localhost/');
    const workerUrl = new URL(WORKER_FILE, base).href;
    const fetchFile = dependencies.fetch || host.fetch?.bind(host);
    const cacheStorage = own(dependencies, 'caches', host.caches);
    const crypto = own(dependencies, 'crypto', host.crypto);
    const serviceWorker = own(dependencies, 'serviceWorker', host.navigator?.serviceWorker);
    const ResponseType = dependencies.Response || host.Response;
    const Controller = dependencies.AbortController || host.AbortController;
    const schedule = dependencies.setTimeout || host.setTimeout.bind(host);
    const cancelSchedule = dependencies.clearTimeout || host.clearTimeout.bind(host);
    const concurrency = Math.max(1, Math.min(6, Number(dependencies.concurrency) || 6));
    const timeoutMs = Math.max(1, Number(dependencies.timeoutMs) || 30000);
    const workerTimeoutMs = Math.max(1, Number(dependencies.workerTimeoutMs) || 2500);
    const cacheTimeoutMs = Math.max(1, Number(dependencies.cacheTimeoutMs) || 1500);
    const jobs = new Map(), queue = [], verifiedFallback = new Set(), liveRuns = new Map();
    const desiredAssets = new Map(), cacheWrites = new Map();
    let active = 0, latest = 0, cachePromise, cacheDisabled = !cacheStorage, workerPromise;
    let state = { ready: false, failed: [], cancelled: [], persistent: false, totalBytes: 0, loadedBytes: 0,
      percent: 0, completed: 0, total: 0 };

    function bypassWorkerCache() {
      try { serviceWorker?.controller?.postMessage({ type: 'xianlai-resource-pack:bypass-cache' }); }
      catch { /* An unavailable controller already falls through to HTTP. */ }
    }
    function disableCache() { cacheDisabled = true; cachePromise = null; bypassWorkerCache(); }
    serviceWorker?.addEventListener?.('controllerchange', () => { if (cacheDisabled) bypassWorkerCache(); });
    if (cacheDisabled) bypassWorkerCache();

    function boundedCache(operation) {
      return new Promise((resolve, reject) => {
        const timer = schedule(() => reject(new Error('Resource cache timed out')), cacheTimeoutMs);
        Promise.resolve().then(operation).then(value => { cancelSchedule(timer); resolve(value); },
          error => { cancelSchedule(timer); reject(error); });
      });
    }
    async function getCache() {
      if (cacheDisabled) return null;
      if (!cachePromise) cachePromise = boundedCache(() => cacheStorage.open(CACHE_NAME))
        .catch(() => { disableCache(); return null; });
      const cache = await cachePromise;
      return cacheDisabled ? null : cache;
    }

    function controlsPage() {
      try {
        const controller = new URL(serviceWorker?.controller?.scriptURL);
        return controller.origin === base.origin && controller.pathname === new URL(workerUrl).pathname;
      } catch { return false; }
    }

    function ensureWorker() {
      if (!serviceWorker?.register || cacheDisabled) return Promise.resolve(false);
      if (workerPromise) return workerPromise;
      workerPromise = new Promise(resolve => {
        let finished = false;
        const finish = value => {
          if (finished) return;
          finished = true;
          cancelSchedule(timer);
          serviceWorker.removeEventListener?.('controllerchange', changed);
          resolve(value);
        };
        const changed = () => { if (controlsPage()) finish(true); };
        const timer = schedule(() => finish(false), workerTimeoutMs);
        serviceWorker.addEventListener?.('controllerchange', changed);
        Promise.resolve().then(() => serviceWorker.register(workerUrl, { scope: base.href, updateViaCache: 'none' }))
          .then(changed, () => finish(false));
      });
      const promise = workerPromise;
      promise.then(ok => { if (!ok && workerPromise === promise) workerPromise = null; });
      return promise;
    }

    function normalize(manifest) {
      if (!manifest || typeof manifest.version !== 'string' || !Array.isArray(manifest.assets)) throw new TypeError('Invalid resource manifest');
      const unique = new Map();
      for (const entry of manifest.assets) {
        const url = new URL(entry.url, base);
        const validKind = entry.kind === 'image' ? IMAGE.test(url.pathname) : entry.kind === 'audio' && AUDIO.test(url.pathname);
        if (url.origin !== base.origin || !url.pathname.startsWith(base.pathname + 'assets/runtime/')
            || /%(?:2f|5c)/i.test(url.pathname) || url.username || url.password || url.hash || !validKind
            || !Number.isSafeInteger(entry.bytes) || entry.bytes <= 0 || !/^[a-f0-9]{64}$/.test(entry.sha256)
            || !['all', 1, 2].includes(entry.density)) throw new TypeError('Invalid static resource descriptor');
        const asset = { ...entry, absoluteUrl: url.href, key: `${url.href}\n${entry.bytes}\n${entry.sha256}` };
        const previous = unique.get(url.href);
        if (previous && (previous.key !== asset.key || previous.density !== asset.density || previous.kind !== asset.kind)) {
          throw new TypeError('Conflicting static resource descriptors');
        }
        unique.set(url.href, asset);
      }
      return [...unique.values()];
    }

    async function digest(bytes) {
      if (crypto?.subtle?.digest) {
        const result = await crypto.subtle.digest('SHA-256', bytes);
        return [...new Uint8Array(result)].map(value => value.toString(16).padStart(2, '0')).join('');
      }
      return sha256Fallback(bytes);
    }

    function pump() {
      while (active < concurrency && queue.length) {
        const job = queue.shift();
        if (job.finished) continue;
        active++; job.running = true; job.run();
      }
    }

    function makeJob(asset) {
      let resolve;
      const controller = Controller ? new Controller() : null;
      const job = { asset, finished: false, running: false, subscribers: new Set(), received: 0,
        promise: new Promise(done => { resolve = done; }) };
      let timer;
      function progress(received) {
        if (job.finished) return;
        job.received = Math.min(asset.bytes, received);
        job.subscribers.forEach(subscriber => subscriber.progress(job.received));
      }
      function finish(ok, reason = '') {
        if (job.finished) return;
        job.finished = true;
        cancelSchedule(timer);
        if (jobs.get(asset.key) === job) jobs.delete(asset.key);
        if (job.running) active--;
        resolve({ url: asset.url, ok, cancelled: reason === 'aborted', reason });
        Promise.resolve().then(pump);
      }
      const valid = () => !job.finished && !controller?.signal.aborted;
      job.cancel = () => { controller?.abort(); finish(false, 'aborted'); };
      job.run = async () => {
        timer = schedule(() => { controller?.abort(); finish(false, 'timeout'); }, timeoutMs);
        try {
          let cache = await getCache();
          if (!valid()) return;
          if (cache) {
            let cached;
            try { cached = await boundedCache(() => cache.match(asset.absoluteUrl)); }
            catch { disableCache(); cache = null; }
            if (!valid()) return;
            if (cached?.status === 200 && cached.headers.get('x-xianlai-sha256') === asset.sha256
                && cached.headers.get('x-xianlai-bytes') === String(asset.bytes)) {
              verifiedFallback.add(asset.key);
              finish(true); return;
            }
          }
          if (!cache && verifiedFallback.has(asset.key)) { finish(true); return; }
          if (!fetchFile) throw new Error('Network loading is unavailable');
          const response = await fetchFile(asset.absoluteUrl, { method: 'GET', cache: 'reload',
            credentials: 'same-origin', redirect: 'error', signal: controller?.signal });
          if (!valid()) return;
          if (!response.ok || response.status !== 200) throw new Error('Incomplete resource response');
          let bytes;
          if (response.body?.getReader) {
            const reader = response.body.getReader(), chunks = [];
            let size = 0;
            try {
              while (true) {
                const part = await reader.read();
                if (!valid()) { await reader.cancel(); return; }
                if (part.done) break;
                size += part.value.byteLength;
                if (size > asset.bytes) { await reader.cancel(); throw new Error('Resource length mismatch'); }
                chunks.push(part.value); progress(size);
              }
            } finally { reader.releaseLock?.(); }
            bytes = new Uint8Array(size);
            let offset = 0;
            for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
          } else {
            bytes = new Uint8Array(await response.arrayBuffer());
            if (valid()) progress(bytes.byteLength);
          }
          if (!valid()) return;
          if (bytes.byteLength !== asset.bytes || await digest(bytes) !== asset.sha256) throw new Error('Resource verification failed');
          if (!valid()) return;
          if (cache && !cacheDisabled) {
            try {
              const headers = new Headers(response.headers);
              headers.delete('content-encoding'); headers.delete('transfer-encoding');
              headers.set('content-length', String(bytes.byteLength));
              headers.set('x-xianlai-bytes', String(bytes.byteLength));
              headers.set('x-xianlai-sha256', asset.sha256);
              headers.set('content-type', MIME[new URL(asset.absoluteUrl).pathname.split('.').pop().toLowerCase()]);
              if (asset.kind === 'audio') headers.set('accept-ranges', 'bytes');
              const previous = cacheWrites.get(asset.absoluteUrl) || Promise.resolve();
              const write = previous.catch(() => {}).then(async () => {
                if (valid() && !cacheDisabled && desiredAssets.get(asset.absoluteUrl) === asset.key) {
                  await cache.put(asset.absoluteUrl, new ResponseType(bytes, { status: 200, headers }));
                }
              });
              cacheWrites.set(asset.absoluteUrl, write);
              // A native put cannot be cancelled. Keep its real completion in
              // the URL chain even when this consumer falls back after timeout.
              const releaseWrite = () => {
                if (cacheWrites.get(asset.absoluteUrl) === write) cacheWrites.delete(asset.absoluteUrl);
              };
              write.then(releaseWrite, releaseWrite);
              await boundedCache(() => write);
            } catch { disableCache(); cache = null; }
          }
          if (!valid()) return;
          verifiedFallback.add(asset.key);
          finish(true);
        } catch (error) {
          if (valid()) finish(false, error?.message || 'download');
        }
      };
      jobs.set(asset.key, job); queue.push(job);
      return job;
    }

    function acquire(asset, signal, report) {
      const aborted = { url: asset.url, ok: false, cancelled: true, reason: 'aborted' };
      if (signal?.aborted) return Promise.resolve(aborted);
      const job = jobs.get(asset.key) || makeJob(asset);
      return new Promise(resolve => {
        let settled = false;
        const subscriber = { progress: report };
        const finish = result => {
          if (settled) return;
          settled = true;
          signal?.removeEventListener('abort', cancel);
          job.subscribers.delete(subscriber);
          resolve(result);
          if (!job.subscribers.size && !job.finished) job.cancel();
        };
        const cancel = () => finish(aborted);
        job.subscribers.add(subscriber);
        signal?.addEventListener('abort', cancel, { once: true });
        if (job.received) report(job.received);
        job.promise.then(finish);
        pump();
      });
    }

    async function cleanOldEntries(allAssets, token) {
      const cache = await getCache();
      if (!cache || latest !== token) return;
      const keep = new Set(allAssets.map(asset => asset.absoluteUrl));
      for (const assets of liveRuns.values()) assets.forEach(asset => keep.add(asset.absoluteUrl));
      for (const job of jobs.values()) keep.add(job.asset.absoluteUrl);
      let cleaning = true;
      try {
        // One deadline covers the entire sweep, so many stale entries cannot
        // multiply a storage stall into a long entry delay.
        await boundedCache(async () => {
          for (const request of await cache.keys()) {
            if (!cleaning || cacheDisabled || latest !== token) return;
            if (!keep.has(request.url)) await cache.delete(request);
          }
        });
      } catch { /* Cache housekeeping never prevents entry. */ }
      finally { cleaning = false; }
    }

    async function prepare(manifest, onProgress = () => {}, settings = {}) {
      const allAssets = normalize(manifest);
      const density = Number(settings.dpr ?? host.devicePixelRatio ?? 1) > 1 ? 2 : 1;
      const assets = allAssets.filter(asset => asset.density === 'all' || asset.density === density);
      const token = ++latest, signal = settings.signal;
      allAssets.forEach(asset => desiredAssets.set(asset.absoluteUrl, asset.key));
      const totalBytes = assets.reduce((sum, asset) => sum + asset.bytes, 0);
      const progress = new Map(assets.map(asset => [asset.key, 0]));
      const completed = new Set(), failed = [], cancelled = [];
      let persistent = false, done = false;
      liveRuns.set(token, allAssets);
      function snapshot(update = {}) {
        const loadedBytes = [...progress.values()].reduce((sum, value) => sum + value, 0);
        const ready = done && completed.size === assets.length && !signal?.aborted;
        const result = { ready, failed: [...failed], cancelled: [...cancelled], persistent: persistent && !cacheDisabled,
          totalBytes, loadedBytes, completed: completed.size, total: assets.length,
          percent: ready ? 100 : Math.min(99, totalBytes ? Math.floor(loadedBytes / totalBytes * 100) : 0), ...update };
        if (token === latest) state = result;
        if (!signal?.aborted) { try { onProgress(result); } catch { /* A UI callback cannot fail a verified file. */ } }
        return result;
      }
      snapshot();
      const worker = signal?.aborted ? Promise.resolve(false) : ensureWorker();
      worker.then(ok => {
        if (!done && !signal?.aborted) {
          persistent = Boolean(ok && !cacheDisabled);
          // A verified file is safe for CSS/Image reuse only after this page
          // is controlled; emit even if no download completes at that instant.
          snapshot();
        }
      });
      try {
        await Promise.all(assets.map(async asset => {
          const result = await acquire(asset, signal, received => { progress.set(asset.key, received); snapshot({ url: asset.url, ok: false }); });
          progress.set(asset.key, result.ok ? asset.bytes : 0);
          if (result.ok) completed.add(asset.key);
          else (result.cancelled ? cancelled : failed).push(asset.url);
          snapshot({ url: asset.url, ok: result.ok });
        }));
        // A cancelled consumer releases its jobs promptly and never waits for SW installation.
        if (!signal?.aborted && !cacheDisabled) {
          persistent = await new Promise(resolve => {
            const finish = value => { signal?.removeEventListener('abort', cancel); resolve(value); };
            const cancel = () => finish(false);
            signal?.addEventListener('abort', cancel, { once: true });
            worker.then(finish);
            if (signal?.aborted) cancel();
          });
        }
        persistent = Boolean(persistent && !cacheDisabled && !signal?.aborted);
        done = true;
        const result = snapshot();
        if (result.ready) await cleanOldEntries(allAssets, token);
        return { ready: result.ready, failed: result.failed, cancelled: result.cancelled, persistent,
          totalBytes, loadedBytes: result.loadedBytes };
      } finally { liveRuns.delete(token); }
    }

    return { prepare, isReady: () => state.ready, getState: () => ({ ...state, failed: [...state.failed], cancelled: [...state.cancelled] }) };
  }

  return { create, CACHE_NAME, WORKER_FILE, sha256Fallback };
});
