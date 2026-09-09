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

  function create(options = {}) {
    const doc = options.document || root.document;
    const host = options.window || root;
    const preloader = options.preloader || root.AssetPreloader;
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

    function mount() {
      overlay = doc.getElementById('login-boot');
      if (!overlay) {
        overlay = doc.createElement('section');
        overlay.id = 'login-boot';
        overlay.className = 'login-boot';
        overlay.setAttribute('aria-label', '\u767b\u5f55\u753b\u9762\u52a0\u8f7d');
        const ring = doc.createElement('span');
        ring.className = 'login-boot-ring';
        ring.setAttribute('aria-hidden', 'true');
        status = doc.createElement('p');
        status.id = 'login-boot-status';
        status.setAttribute('role', 'status');
        status.setAttribute('aria-live', 'polite');
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
        overlay.append(ring, status, actions);
        screen.append(overlay);
      } else {
        status = doc.getElementById('login-boot-status');
        retryButton = doc.getElementById('login-boot-retry');
        simpleButton = doc.getElementById('login-boot-simple');
      }
      retryButton?.addEventListener('click', retry);
      simpleButton?.addEventListener('click', enterSimplified);
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
    }

    function finish(simplified = false) {
      if (destroyed || !criticalReady || phase === 'ready') return;
      if (!runtimeReady) {
        pendingFinish = simplified;
        update('runtime', '\u6b63\u5728\u51c6\u5907\u5165\u5883');
        return;
      }
      const images = Object.fromEntries([...CRITICAL_ASSETS, ...DECORATION_ASSETS]
        .map(src => [src, preloader.getImage?.(src)]).filter(([, image]) => image));
      phase = 'ready';
      screen.classList.remove('login-boot-pending');
      screen.classList.add('login-boot-ready');
      screen.classList.toggle('login-boot-simplified', simplified);
      screen.setAttribute('aria-busy', 'false');
      if (shell) { shell.inert = false; shell.removeAttribute('aria-hidden'); }
      if (overlay) overlay.hidden = true;
      resolveReady({ criticalReady: true, simplified, failed: [...failures], images });
    }

    function markRuntimeReady() {
      runtimeReady = true;
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
      update('loading', '\u6b63\u5728\u5c55\u5377');
      try {
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
      retryButton?.removeEventListener('click', retry);
      simpleButton?.removeEventListener('click', enterSimplified);
      resolveReady?.({ cancelled: true, criticalReady: false });
    }

    return { start, whenReady: start, retry, enterSimplified, destroy, markRuntimeReady,
      getState: () => ({ phase, criticalReady, runtimeReady, failed: [...failures] }) };
  }

  let instance;
  const api = {
    create,
    getCriticalAssets: () => [...CRITICAL_ASSETS],
    getDecorationAssets: () => [...DECORATION_ASSETS],
    start(options) { instance ||= create(options); return instance.start(); },
    whenReady() { return api.start(); },
    retry() { return instance?.retry(); },
    markRuntimeReady() { instance?.markRuntimeReady(); },
    getState() { return instance?.getState() || { phase: 'idle', criticalReady: false, failed: [] }; },
  };
  root.LoginBoot = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
