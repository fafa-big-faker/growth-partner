(function initAssetPreloader(root) {
  function collect(groups) {
    const urls = [];
    const visit = value => {
      if (typeof value === 'string' && /\.(png|jpe?g|webp|gif|svg)(\?.*)?$/i.test(value)) urls.push(value);
      else if (Array.isArray(value)) value.forEach(visit);
      else if (value && typeof value === 'object') Object.values(value).forEach(visit);
    };
    visit(groups);
    return [...new Set(urls)];
  }

  function create(options = {}) {
    const ImageCtor = options.Image || root.Image;
    const setTimer = options.setTimeout || root.setTimeout.bind(root);
    const clearTimer = options.clearTimeout || root.clearTimeout.bind(root);
    const concurrency = Math.max(1, Math.min(12, Number(options.concurrency) || 6));
    const successful = new Map();
    const pending = new Map();
    const queue = [];
    let active = 0;

    function pump() {
      while (active < concurrency && queue.length) {
        const job = queue.shift();
        if (job.finished) continue;
        job.running = true;
        active++;
        job.run();
      }
    }

    function makeJob(src, settings) {
      let resolve;
      const job = { src, consumers: 0, finished: false, running: false,
        promise: new Promise(done => { resolve = done; }) };
      let image;
      let timer;
      let attempt = 0;
      const timeout = Math.max(1, Number(settings.timeoutMs ?? options.timeoutMs) || 15000);
      const retries = Math.max(0, Math.min(3, Number(settings.retries ?? options.retries) || 0));
      function cleanup(stop = false) {
        clearTimer(timer);
        if (image) {
          image.onload = null;
          image.onerror = null;
          if (stop) image.src = '';
        }
      }
      function finish(ok, reason = '') {
        if (job.finished) return;
        job.finished = true;
        cleanup(!ok);
        if (pending.get(src) === job) pending.delete(src);
        if (ok) successful.set(src, image);
        if (job.running) active--;
        resolve({ src, ok, reason, cancelled: reason === 'aborted', image: ok ? image : null });
        Promise.resolve().then(pump);
      }
      job.cancel = () => finish(false, 'aborted');
      job.run = () => {
        if (job.finished) return;
        attempt++;
        const version = attempt;
        let decoding = false;
        const fail = reason => {
          if (job.finished || attempt !== version) return;
          cleanup(true);
          if (attempt <= retries) job.run();
          else finish(false, reason);
        };
        if (typeof ImageCtor !== 'function') { finish(false, 'unsupported'); return; }
        try {
          image = new ImageCtor();
          image.decoding = 'async';
          const currentImage = image;
          image.onload = () => {
            if (job.finished || attempt !== version || decoding) return;
            if (!currentImage.naturalWidth) { fail('load'); return; }
            decoding = true;
            Promise.resolve().then(() => currentImage.decode?.()).then(() => {
              if (!job.finished && attempt === version) finish(true);
            }, () => fail('decode'));
          };
          image.onerror = () => fail('load');
          timer = setTimer(() => fail('timeout'), timeout);
          image.src = src;
          if (image.complete && image.naturalWidth > 0) image.onload?.();
        } catch { fail('load'); }
      };
      pending.set(src, job);
      queue.push(job);
      return job;
    }

    function load(src, settings = {}) {
      const signal = settings.signal;
      const aborted = () => ({ src, ok: false, cancelled: true, reason: 'aborted', image: null });
      if (signal?.aborted) return Promise.resolve(aborted());
      if (successful.has(src)) return Promise.resolve({ src, ok: true, reason: '', cancelled: false, image: successful.get(src) });
      const job = pending.get(src) || makeJob(src, settings);
      job.consumers++;
      const result = new Promise(resolve => {
        let settled = false;
        const finish = value => {
          if (settled) return;
          settled = true;
          signal?.removeEventListener('abort', cancel);
          job.consumers--;
          resolve(value);
          // One cancelled caller must not cancel another caller's shared image.
          if (!job.consumers && !job.finished) job.cancel();
        };
        const cancel = () => finish(aborted());
        signal?.addEventListener('abort', cancel, { once: true });
        job.promise.then(finish);
      });
      pump();
      return result;
    }

    async function preload(urls, onProgress = () => {}, settings = {}) {
      const unique = [...new Set(urls || [])];
      let loaded = 0;
      let completed = 0;
      const failed = [];
      const cancelled = [];
      const report = result => onProgress({ loaded, completed, total: unique.length,
        percent: unique.length ? Math.floor(loaded / unique.length * 100) : 100,
        failed: [...failed], cancelled: [...cancelled], ...result });
      report();
      await Promise.all(unique.map(async src => {
        const result = await load(src, settings);
        completed++;
        if (result.ok) loaded++;
        else if (result.cancelled) cancelled.push(src);
        else failed.push(src);
        report({ src, ok: result.ok, reason: result.reason });
      }));
      return { total: unique.length, loaded, completed, failed, cancelled };
    }

    return { collect, preload, load, getImage: src => successful.get(src) || null };
  }

  const api = { ...create(), create };
  root.AssetPreloader = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
