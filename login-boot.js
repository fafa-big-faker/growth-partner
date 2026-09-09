(function initLoginBoot(root) {
  const BACKGROUND = 'assets/runtime/v3/backgrounds/login.webp';
  const ELEMENT_ASSETS = Object.freeze({
    'login-brand-image': 'assets/runtime/v3/ui/logo.webp',
    'login-submit-brush': 'assets/runtime/v6/ui/login-brush.webp?v=xianlai-v6-20260908',
    'login-submit-lettering': 'assets/runtime/v6/ui/login-lettering.webp?v=xianlai-v6-20260908',
  });
  const CRITICAL_ASSETS = Object.freeze([BACKGROUND, ...Object.values(ELEMENT_ASSETS)]);
  const DECORATION_ASSETS = Object.freeze(Array.from({ length: 6 }, (_, index) =>
    `assets/runtime/v5/effects/ink-0${index + 1}.webp?v=xianlai-v5-20260908`));
  const ENTRY_BACKGROUND = 'assets/runtime/entry-preparation/background.webp?v=entry-preparation-20260910';
  const ENTRY_ASSETS = Object.freeze([ENTRY_BACKGROUND,
    'assets/runtime/ink-controls/exp-track.webp?v=ink-controls-20260909',
    'assets/runtime/ink-controls/exp-fill.webp?v=ink-controls-20260909']);
  const QUOTES = Object.freeze([
    '修仙可以慢慢来，\n饭要记得按时吃。',
    '仙树正在整理发型，\n请稍候。',
    '今日宜：攒点勇气，\n也攒点小钱钱。',
    '今天不必大放异彩，\n迈出一点就很好。',
    '仙途很长，\n先把今天过好。',
    '允许自己慢一点，\n小小的进步也算数。',
  ]);

  function create(options = {}) {
    const doc = options.document || root.document;
    const host = options.window || root;
    const preloader = options.preloader || root.AssetPreloader;
    const resourcePack = options.resourcePack || root.ResourcePack;
    const manifest = options.manifest || root.BootAssetManifest;
    const requireResourcePack = !!options.requireResourcePack;
    const setTimer = options.setTimeout || root.setTimeout.bind(root);
    const clearTimer = options.clearTimeout || root.clearTimeout.bind(root);
    const screen = doc?.getElementById('login-screen');
    const shell = screen?.querySelector('.login-shell');
    const timeoutMs = Math.max(1, Number(options.timeoutMs) || 12000);
    const decorationTimeoutMs = Math.max(1, Number(options.decorationTimeoutMs) || 5000);
    const AbortCtor = options.AbortController || root.AbortController;
    let phase = 'idle';
    let currentAttempt = 0;
    let controller;
    let resolveReady;
    let readyPromise;
    let criticalReady = false;
    let destroyed = false;
    let overlay;
    let status;
    let retryButton;
    let simpleButton;
    let failures = [];
    let runtimeReady = !options.waitForRuntime;
    let pendingFinish = null;
    let resourcesReady = false;
    let persistent = false;
    let gameAssets = [];
    let progress = 0;
    const preparedEntryAssets = new Set();
    let quoteIndex = Math.floor((options.random || Math.random)() * QUOTES.length) % QUOTES.length;
    let quote, track, fill, percentLabel;
    let quoteTimer = null, quoteSwapTimer = null, runtimeTimer = null;

    function stopQuotes() {
      clearTimer(quoteTimer);
      clearTimer(quoteSwapTimer);
      quoteTimer = quoteSwapTimer = null;
      quote?.classList.remove('is-changing');
    }

    function animateQuote() {
      stopQuotes();
      if (destroyed || phase === 'ready' || phase === 'error' || doc?.hidden) return;
      quoteTimer = setTimer(() => {
        quoteIndex = (quoteIndex + 1) % QUOTES.length;
        const swap = () => {
          quoteSwapTimer = null;
          if (destroyed || phase === 'ready' || phase === 'error') return;
          quote.textContent = QUOTES[quoteIndex];
          quote.classList.remove('is-changing');
          animateQuote();
        };
        if (host.matchMedia?.('(prefers-reduced-motion: reduce)').matches) swap();
        else { quote.classList.add('is-changing'); quoteSwapTimer = setTimer(swap, 180); }
      }, 6000);
    }

    function setProgress(value) {
      progress = Math.min(100, Math.max(0, Number(value) || 0));
      if (fill?.style) fill.style.width = `${progress}%`;
      track?.setAttribute('aria-valuenow', String(Math.floor(progress)));
      if (percentLabel) percentLabel.textContent = `${Math.floor(progress)}%`;
    }

    function mount() {
      overlay = doc.getElementById('login-boot');
      if (!overlay) {
        overlay = doc.createElement('section');
        overlay.id = 'login-boot';
        overlay.className = 'login-boot';
        overlay.setAttribute('aria-label', '入境准备');
        const content = doc.createElement('div');
        content.className = 'login-boot-content';
        const brand = doc.createElement('p');
        brand.className = 'login-boot-brand';
        brand.textContent = '仙来';
        const kicker = doc.createElement('span');
        kicker.className = 'login-boot-kicker';
        kicker.textContent = '修行小笺';
        quote = doc.createElement('p');
        quote.id = 'login-boot-quote';
        const preparation = doc.createElement('div');
        preparation.className = 'login-boot-preparation';
        track = doc.createElement('div');
        track.id = 'login-boot-track';
        track.setAttribute('role', 'progressbar');
        track.setAttribute('aria-label', '资源准备进度');
        track.setAttribute('aria-valuemin', '0');
        track.setAttribute('aria-valuemax', '100');
        fill = doc.createElement('span');
        fill.id = 'login-boot-fill';
        track.append(fill);
        const meta = doc.createElement('div');
        meta.className = 'login-boot-meta';
        status = doc.createElement('p');
        status.id = 'login-boot-status';
        status.setAttribute('role', 'status');
        status.setAttribute('aria-live', 'polite');
        percentLabel = doc.createElement('span');
        percentLabel.id = 'login-boot-percent';
        percentLabel.setAttribute('aria-hidden', 'true');
        meta.append(status, percentLabel);
        const actions = doc.createElement('div');
        actions.className = 'login-boot-actions';
        retryButton = doc.createElement('button');
        retryButton.type = 'button';
        retryButton.id = 'login-boot-retry';
        retryButton.textContent = '\u91cd\u8bd5';
        simpleButton = doc.createElement('button');
        simpleButton.type = 'button';
        simpleButton.id = 'login-boot-simple';
        simpleButton.textContent = '\u7b80\u5316\u8fdb\u5165';
        actions.append(retryButton, simpleButton);
        preparation.append(track, meta, actions);
        content.append(brand, kicker, quote, preparation);
        overlay.append(content);
        screen.append(overlay);
      } else {
        status = doc.getElementById('login-boot-status');
        retryButton = doc.getElementById('login-boot-retry');
        simpleButton = doc.getElementById('login-boot-simple');
        quote = doc.getElementById('login-boot-quote');
        track = doc.getElementById('login-boot-track');
        fill = doc.getElementById('login-boot-fill');
        percentLabel = doc.getElementById('login-boot-percent');
      }
      if (quote) quote.textContent = QUOTES[quoteIndex];
      setProgress(0);
      retryButton?.addEventListener('click', retry);
      simpleButton?.addEventListener('click', enterSimplified);
      doc?.addEventListener?.('visibilitychange', animateQuote);
      screen.classList.add('login-boot-mounted', 'login-boot-pending');
      screen.setAttribute('aria-busy', 'true');
      if (shell) { shell.inert = true; shell.setAttribute('aria-hidden', 'true'); }
    }

    function update(nextPhase, copy) {
      phase = nextPhase;
      if (overlay) overlay.dataset.phase = phase;
      if (status) status.textContent = copy;
      if (retryButton) retryButton.hidden = phase !== 'error';
      if (simpleButton) simpleButton.hidden = phase !== 'error' || !criticalReady;
      if (phase === 'error') stopQuotes();
    }

    async function finish(simplified = false) {
      if (destroyed || !criticalReady || phase === 'ready' || phase === 'decoding-game') return;
      if (!runtimeReady) {
        pendingFinish = simplified;
        update('runtime', '正在连接仙途');
        clearTimer(runtimeTimer);
        runtimeTimer = setTimer(() => {
          runtimeTimer = null;
          if (!destroyed && !runtimeReady) update('error', '入境连接暂未完成，请重试');
        }, 20000);
        return;
      }
      const version = currentAttempt;
      if (gameAssets.length) {
        update('decoding-game', '正在铺开画卷');
        let decoded;
        try {
          decoded = await preloader.preload(gameAssets, next => {
            if (!destroyed && version === currentAttempt) setProgress(97 + next.percent * .02);
          }, { signal: controller.signal, timeoutMs, retries: 1 });
        } catch {
          if (!destroyed && version === currentAttempt) {
            criticalReady = false;
            update('error', '部分画卷未展开，请重试');
          }
          return;
        }
        if (destroyed || version !== currentAttempt) return;
        if (decoded.failed.length || decoded.cancelled?.length) {
          failures = decoded.failed.concat(decoded.cancelled || []);
          criticalReady = false;
          update('error', '部分画卷未展开，请重试');
          return;
        }
      }
      const images = Object.fromEntries([...CRITICAL_ASSETS, ...DECORATION_ASSETS]
        .map(src => [src, preloader.getImage?.(src)]).filter(([, image]) => image));
      phase = 'ready';
      setProgress(100);
      stopQuotes();
      clearTimer(runtimeTimer);
      doc?.removeEventListener?.('visibilitychange', animateQuote);
      screen.classList.remove('login-boot-pending');
      screen.classList.add('login-boot-ready');
      screen.classList.toggle('login-boot-simplified', simplified);
      screen.setAttribute('aria-busy', 'false');
      if (shell) { shell.inert = false; shell.removeAttribute('aria-hidden'); }
      if (overlay) overlay.hidden = true;
      doc.querySelectorAll?.('img[data-boot-src]').forEach(image => {
        if (!image.getAttribute('src')) image.src = image.dataset.bootSrc;
        image.removeAttribute('data-boot-src');
      });
      resolveReady({ criticalReady: true, resourcesReady, persistent, simplified, failed: [...failures], images });
    }

    function markRuntimeReady(settings = {}) {
      runtimeReady = true;
      gameAssets = [...new Set(settings.imageAssets || [])];
      clearTimer(runtimeTimer);
      if (pendingFinish !== null) {
        const simplified = pendingFinish;
        pendingFinish = null;
        finish(simplified);
      }
    }

    function enterSimplified() {
      if (phase === 'error' && criticalReady) finish(true);
    }

    async function decodeElements(signal) {
      return Promise.all(Object.entries(ELEMENT_ASSETS).map(([id, src]) => new Promise(resolve => {
        const image = doc.getElementById(id);
        if (!image) { resolve(src); return; }
        let settled = false;
        let timer;
        const finishDecode = ok => {
          if (settled) return;
          settled = true;
          clearTimer(timer);
          signal?.removeEventListener('abort', onAbort);
          image.removeEventListener('load', onLoad);
          image.removeEventListener('error', onError);
          resolve(ok ? null : src);
        };
        const onAbort = () => finishDecode(false);
        const onError = () => finishDecode(false);
        const onLoad = () => {
          if (!image.naturalWidth) { finishDecode(false); return; }
          Promise.resolve().then(() => image.decode?.()).then(() => finishDecode(true), onError);
        };
        signal?.addEventListener('abort', onAbort, { once: true });
        image.addEventListener('load', onLoad);
        image.addEventListener('error', onError);
        timer = setTimer(onError, timeoutMs);
        if (signal?.aborted) { onAbort(); return; }
        if (image.complete && image.naturalWidth > 0) onLoad();
        else image.src = src;
      })));
    }

    async function runAttempt() {
      const version = ++currentAttempt;
      controller?.abort();
      controller = new AbortCtor();
      const signal = controller.signal;
      failures = [];
      criticalReady = false;
      update('loading', '正在准备画卷');
      animateQuote();
      try {
        if (requireResourcePack && (!resourcePack || !manifest)) {
          update('error', '资源清单未载入，请重试');
          return;
        }
        if (resourcePack && manifest) {
          resourcesReady = false;
          const prepared = await resourcePack.prepare(manifest, next => {
            if (destroyed || version !== currentAttempt) return;
            setProgress(next.percent * .94);
            if (ENTRY_ASSETS.includes(next.url) && next.ok) preparedEntryAssets.add(next.url);
            if (next.persistent && preparedEntryAssets.has(ENTRY_BACKGROUND)) overlay.classList.add('has-art');
            if (next.persistent && ENTRY_ASSETS.every(url => preparedEntryAssets.has(url))) overlay.classList.add('has-track-art');
          }, { signal, dpr: host.devicePixelRatio || 1 });
          if (destroyed || version !== currentAttempt) return;
          failures = [...prepared.failed, ...(prepared.cancelled || [])];
          if (!prepared.ready) {
            update('error', '部分资源未备齐，请重试');
            return;
          }
          resourcesReady = true;
          persistent = prepared.persistent;
          overlay.classList.add('has-art');
          overlay.classList.add('has-track-art');
          setProgress(94);
          update('loading', '正在展开登录画卷');
        }
        const critical = await preloader.preload(CRITICAL_ASSETS, () => {}, { signal, timeoutMs, retries: 1 });
        if (destroyed || version !== currentAttempt) return;
        failures = critical.failed.concat(critical.cancelled || []);
        if (!failures.length) failures = (await decodeElements(signal)).filter(Boolean);
        if (destroyed || version !== currentAttempt) return;
        if (failures.length) {
          update('error', '\u753b\u5377\u672a\u8f7d\u5165\uff0c\u8bf7\u91cd\u8bd5');
          return;
        }
        criticalReady = true;
        if (resourcesReady) setProgress(96);
        const reduced = host.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
        if (reduced) { finish(true); return; }
        const decorations = await preloader.preload(DECORATION_ASSETS, () => {},
          { signal, timeoutMs: decorationTimeoutMs, retries: 0 });
        if (destroyed || version !== currentAttempt) return;
        failures = decorations.failed.concat(decorations.cancelled || []);
        if (failures.length) update('error', '\u90e8\u5206\u58a8\u8ff9\u672a\u8f7d\u5165');
        else finish();
      } catch {
        if (!destroyed && version === currentAttempt) update('error', '\u753b\u5377\u672a\u8f7d\u5165\uff0c\u8bf7\u91cd\u8bd5');
      }
    }

    function retry() {
      if (!destroyed && phase === 'error' && requireResourcePack && (!resourcePack || !manifest)) {
        host.location?.reload?.();
        return readyPromise;
      }
      if (!destroyed && phase === 'error' && criticalReady && !runtimeReady) {
        host.location?.reload?.();
        return readyPromise;
      }
      if (!destroyed && phase === 'error') void runAttempt();
      return readyPromise;
    }

    function start() {
      if (readyPromise) return readyPromise;
      readyPromise = new Promise(resolve => { resolveReady = resolve; });
      if (destroyed || !screen) {
        resolveReady({ cancelled: true, criticalReady: false });
        return readyPromise;
      }
      mount();
      void runAttempt();
      return readyPromise;
    }

    function destroy() {
      destroyed = true;
      currentAttempt++;
      controller?.abort();
      stopQuotes();
      clearTimer(runtimeTimer);
      doc?.removeEventListener?.('visibilitychange', animateQuote);
      retryButton?.removeEventListener('click', retry);
      simpleButton?.removeEventListener('click', enterSimplified);
      resolveReady?.({ cancelled: true, criticalReady: false });
    }

    return { start, whenReady: start, retry, enterSimplified, destroy, markRuntimeReady,
      getState: () => ({ phase, criticalReady, runtimeReady, resourcesReady, persistent, percent: progress, failed: [...failures] }) };
  }

  let instance;
  const api = {
    create,
    getCriticalAssets: () => [...CRITICAL_ASSETS],
    getDecorationAssets: () => [...DECORATION_ASSETS],
    getEntryAssets: () => [...ENTRY_ASSETS],
    start(options) { instance ||= create(options); return instance.start(); },
    whenReady() { return api.start(); },
    retry() { return instance?.retry(); },
    markRuntimeReady(settings) { instance?.markRuntimeReady(settings); },
    getState() { return instance?.getState() || { phase: 'idle', criticalReady: false, failed: [] }; },
  };
  root.LoginBoot = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
