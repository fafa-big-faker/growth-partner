(function initLoginArt(root) {
  const IMAGE_ASSETS = Object.freeze(Array.from({ length: 6 }, (_, index) =>
    `assets/runtime/v5/effects/ink-0${index + 1}.webp?v=xianlai-v5-20260908`));
  const BACKDROP_ASSET = 'assets/runtime/v3/backgrounds/login.webp';

  function create(options = {}) {
    const doc = options.document || root.document;
    const host = options.window || root;
    const requestFrame = options.requestAnimationFrame || host.requestAnimationFrame.bind(host);
    const cancelFrame = options.cancelAnimationFrame || host.cancelAnimationFrame.bind(host);
    const now = options.now || (() => host.performance.now());
    const setTimer = options.setTimeout || host.setTimeout?.bind(host) || root.setTimeout.bind(root);
    const clearTimer = options.clearTimeout || host.clearTimeout?.bind(host) || root.clearTimeout.bind(root);
    const screen = doc.getElementById('login-screen');
    const logo = doc.getElementById('login-brand-image');
    const fallback = doc.getElementById('login-brand-fallback');
    const canvas = doc.getElementById('login-ink-canvas');
    const bar = doc.getElementById('login-loading-bar');
    const label = doc.getElementById('login-loading-percent');
    const track = doc.getElementById('login-loading-track');
    const button = doc.getElementById('login-submit');
    const buttonBrush = doc.getElementById('login-submit-brush');
    const buttonLettering = doc.getElementById('login-submit-lettering');
    const ripple = doc.getElementById('login-button-ink');
    const form = doc.getElementById('login-form-panel');
    const media = host.matchMedia?.('(prefers-reduced-motion: reduce)');
    let context = null;
    try { context = canvas?.getContext('2d'); } catch { /* Decoration is optional. */ }
    let visible = true;
    let intersecting = true;
    let reduced = Boolean(media?.matches);
    let started = false;
    let destroyed = false;
    let logoReady = false;
    let revealed = false;
    let revealComplete = false;
    let backdropReady = false;
    let backdropImage = null;
    let backdropTimer = null;
    let settlingTimer = null;
    let settlingVersion = 0;
    let logoAnimation = null;
    let floatAnimation = null;
    let rippleAnimation = null;
    let observer = null;
    let resizeObserver = null;
    let geometryDirty = true;
    let geometry = null;
    let frame = null;
    let lastDraw = -Infinity;
    let lastMotionTick = null;
    let motionTime = 0;
    let lastPulse = -Infinity;
    let loading = false;
    let target = 0;
    let displayed = 0;
    let progressFrom = 0;
    let progressStart = 0;
    let texturesStarted = false;
    let touchGlowTimer = null;
    const textures = [];
    const imageRequests = [];
    const buttonArtwork = [buttonBrush, buttonLettering].filter(Boolean).map(image => ({ image, ready: false }));

    const active = () => !destroyed && visible && intersecting && !doc.hidden;
    const hasTextures = () => textures.some(Boolean);

    function syncButtonArtwork() {
      if (destroyed) return;
      button?.classList.toggle('login-submit-art-ready', buttonArtwork.length === 2 && buttonArtwork.every(entry => entry.ready));
    }

    function initButtonArtwork() {
      buttonArtwork.forEach(entry => {
        entry.onLoad = () => {
          entry.ready = entry.image.naturalWidth > 0;
          syncButtonArtwork();
        };
        entry.onError = () => { entry.ready = false; syncButtonArtwork(); };
        entry.image.addEventListener('load', entry.onLoad);
        entry.image.addEventListener('error', entry.onError);
        entry.ready = Boolean(entry.image.complete && entry.image.naturalWidth > 0);
      });
      syncButtonArtwork();
    }

    function paintProgress() {
      if (bar) {
        bar.style.width = '100%';
        bar.style.transform = `scaleX(${displayed / 100})`;
      }
      if (label) label.textContent = `${Math.floor(displayed)}%`;
      track?.setAttribute('aria-valuenow', String(Math.floor(displayed)));
      track?.style.setProperty('--login-progress', `${displayed}%`);
      track?.classList.toggle('loading-track-started', displayed > 0);
      track?.classList.toggle('loading-track-complete', displayed >= 100);
    }

    function floatLogo() {
      if (!logoReady || !revealComplete || floatAnimation || !active() || reduced
          || typeof logo?.animate !== 'function') return;
      floatAnimation = logo.animate([
        { transform: 'translateY(0)' },
        { transform: 'translateY(-10px)' },
        { transform: 'translateY(0)' },
      ], { duration: 6400, iterations: Infinity, easing: 'ease-in-out' });
    }

    function revealLogo() {
      if (!logoReady || revealed || !active()) return;
      revealed = true;
      logo.style.visibility = 'visible';
      if (reduced || typeof logo.animate !== 'function') {
        revealComplete = true;
        return;
      }
      logoAnimation = logo.animate([
        { opacity: 0, clipPath: 'polygon(0 0, 0 0, 0 22%, 0 44%, 0 70%, 0 100%, 0 100%)', transform: 'translateY(3px)' },
        { opacity: 0.85, clipPath: 'polygon(0 0, 65% 0, 56% 22%, 69% 44%, 49% 70%, 43% 100%, 0 100%)', offset: 0.55 },
        { opacity: 1, clipPath: 'polygon(0 0, 100% 0, 100% 22%, 100% 44%, 100% 70%, 100% 100%, 0 100%)', transform: 'translateY(0)' },
      ], { duration: 1500, easing: 'cubic-bezier(.22,.55,.28,1)', fill: 'both' });
      logoAnimation.onfinish = () => {
        const completed = logoAnimation;
        logoAnimation = null;
        completed?.cancel();
        revealComplete = true;
        floatLogo();
      };
    }

    function cancelSettling() {
      settlingVersion++;
      if (settlingTimer !== null) clearTimer(settlingTimer);
      settlingTimer = null;
    }

    function requestLogoReveal() {
      if (!logoReady || revealed || !active()) return;
      if (reduced || typeof logo.animate !== 'function') {
        cancelSettling();
        revealLogo();
        return;
      }
      if (!backdropReady || settlingTimer !== null) return;
      const version = ++settlingVersion;
      // Only the decorative entrance waits; form controls and authentication stay independent.
      settlingTimer = setTimer(() => {
        if (version !== settlingVersion || !active()) return;
        settlingTimer = null;
        if (logoReady && backdropReady && !revealed) revealLogo();
      }, 500);
    }

    function loadBackdrop() {
      if (options.prepared?.criticalReady) {
        backdropReady = true;
        requestLogoReveal();
        return;
      }
      if (typeof host.Image !== 'function') {
        backdropReady = true;
        requestLogoReveal();
        return;
      }
      backdropImage = new host.Image();
      backdropImage.decoding = 'async';
      const settled = () => {
        if (destroyed || backdropReady) return;
        cancelBackdropDeadline();
        backdropReady = true;
        requestLogoReveal();
      };
      backdropImage.onload = settled;
      backdropImage.onerror = settled;
      if (!reduced) backdropTimer = setTimer(settled, 2500);
      backdropImage.src = BACKDROP_ASSET;
      if (backdropImage.complete && backdropImage.naturalWidth > 0) settled();
    }

    function cancelBackdropDeadline() {
      if (backdropTimer !== null) clearTimer(backdropTimer);
      backdropTimer = null;
    }

    function onLogoLoad() {
      logoReady = true;
      geometryDirty = true;
      if (fallback) fallback.hidden = true;
      requestLogoReveal();
    }

    function onLogoError() {
      logoReady = false;
      cancelSettling();
      logoAnimation?.cancel();
      logoAnimation = null;
      floatAnimation?.cancel();
      floatAnimation = null;
      if (logo) logo.style.visibility = 'hidden';
      if (fallback) fallback.hidden = false;
    }

    function loadTextures() {
      if (texturesStarted || destroyed || !context || reduced || typeof host.Image !== 'function') return;
      texturesStarted = true;
      IMAGE_ASSETS.forEach((url, index) => {
        if (options.prepared) {
          const prepared = options.prepared.images?.[url];
          if (prepared?.naturalWidth) textures[index] = prepared;
          return;
        }
        const image = new host.Image();
        image.decoding = 'async';
        image.onload = () => {
          if (destroyed || !image.naturalWidth) return;
          textures[index] = image;
          schedule();
        };
        image.onerror = () => { image.onload = null; image.onerror = null; };
        imageRequests.push(image);
        image.src = url;
      });
    }

    function measureScene() {
      const bounds = screen?.getBoundingClientRect?.();
      const width = Math.max(1, bounds?.width || canvas.width || 960);
      const height = Math.max(1, bounds?.height || canvas.height || 720);
      const mobile = width < 600;
      const resolution = Math.min(host.devicePixelRatio || 1, mobile ? 1 : 1.5, 1600 / width, 1100 / height);
      canvas.width = Math.round(width * resolution);
      canvas.height = Math.round(height * resolution);
      context.setTransform(canvas.width / width, 0, 0, canvas.height / height, 0, 0);
      const localRect = element => {
        const rect = element?.getBoundingClientRect?.();
        if (!rect?.width || !rect?.height) return null;
        return { x: rect.left - (bounds?.left || 0), y: rect.top - (bounds?.top || 0), width: rect.width, height: rect.height };
      };
      const brandWidth = Math.min(380, width * .85);
      const brand = localRect(logo?.parentElement) || localRect(logo) || {
        x: (width - brandWidth) / 2, y: height * .14, width: brandWidth, height: brandWidth * 512 / 949,
      };
      const access = localRect(form?.parentElement || form);
      const centerX = brand.x + brand.width / 2;
      const centerY = brand.y + brand.height / 2;
      const size = Math.min(mobile ? 290 : 395, width * (mobile ? .78 : .35));
      const traces = mobile ? [
        { texture: 2, x: centerX - brand.width * .29, y: centerY - brand.height * .20, size, angle: -.25, phase: .15, axis: 'y' },
        { texture: 4, x: centerX + brand.width * .10, y: centerY + brand.height * .64, size: size * 1.08, angle: -.15, phase: .65, axis: 'x' },
      ] : [
        { texture: 0, x: centerX - brand.width * .65, y: centerY, size, angle: -.20, phase: .10, axis: 'y' },
        { texture: 1, x: centerX + brand.width * .38, y: centerY - brand.height * .32, size: size * .90, angle: .45, phase: .46, axis: 'y' },
        { texture: 4, x: centerX + brand.width * .35, y: centerY + brand.height * .69, size: size * 1.08, angle: -.15, phase: .76, axis: 'x' },
      ];
      geometry = { width, height, mobile, brand, access, traces };
      geometryDirty = false;
    }

    function drawTrace(trace, time) {
      const image = textures[trace.texture] || textures.find(Boolean);
      if (!image) return;
      const phase = (time / 12800 + trace.phase) % 1;
      const theta = phase * Math.PI * 2;
      const visibility = .36 + Math.sin(Math.PI * phase) ** 2 * .24;
      context.save();
      context.translate(trace.x + Math.sin(theta) * 16, trace.y + Math.cos(theta + .7) * 9);
      context.rotate(trace.angle + Math.sin(theta + .4) * .07);
      context.globalAlpha = visibility;
      const size = trace.size * (1 + Math.sin(theta + .9) * .035);
      const strips = geometry.mobile ? 16 : 20;
      const sourceSize = image.naturalWidth;
      // Each narrow strip follows the same travelling bend, preserving the supplied ink detail.
      for (let strip = 0; strip < strips; strip++) {
        const fraction = strip / strips;
        const bend = Math.sin(fraction * Math.PI * 2 - theta) * 5 * Math.sin(fraction * Math.PI);
        const source = fraction * sourceSize;
        const sourceStep = sourceSize / strips;
        const destination = (fraction - .5) * size;
        const destinationStep = size / strips;
        if (trace.axis === 'x') {
          context.drawImage(image, source, 0, sourceStep, sourceSize,
            destination, -size / 2 + bend, destinationStep + .35, size);
        } else {
          context.drawImage(image, 0, source, sourceSize, sourceStep,
            -size / 2 + bend, destination, size, destinationStep + .35);
        }
      }
      context.restore();
    }

    function drawFragments(time) {
      const image = textures[5];
      if (!image) return;
      const { brand, mobile } = geometry;
      const crops = [[190, 24, 290, 226], [34, 180, 242, 220], [210, 218, 280, 278]];
      const count = mobile ? 3 : 5;
      for (let index = 0; index < count; index++) {
        const phase = (time / 9600 + index / count) % 1;
        const opacity = Math.sin(phase * Math.PI) ** 2 * .44;
        const side = index % 2 ? 1 : -1;
        const x = brand.x + brand.width / 2 + side * brand.width * (.35 + phase * .18);
        const y = brand.y + brand.height * (.8 - phase) + Math.sin(phase * Math.PI) * 16;
        const crop = crops[index % crops.length];
        const size = mobile ? 24 + index * 4 : 29 + index * 5;
        context.save();
        context.globalAlpha = opacity;
        context.translate(x, y);
        context.rotate(side * .25 + phase * .2);
        context.drawImage(image, ...crop, -size / 2, -size * crop[3] / crop[2] / 2, size, size * crop[3] / crop[2]);
        context.restore();
      }
    }

    function drawInk(time) {
      if (!context || !canvas || !hasTextures()) return;
      if (geometryDirty || !geometry) measureScene();
      const { width, height, access, brand, traces } = geometry;
      context.clearRect(0, 0, width, height);
      context.save();
      context.globalCompositeOperation = 'source-over';
      context.beginPath();
      context.rect(0, 0, width, height);
      if (access) context.rect(access.x - 12, access.y - 12, access.width + 24, access.height + 24);
      if (!logoReady) context.rect(brand.x - 12, brand.y - 14, brand.width + 24, brand.height + 28);
      context.clip('evenodd');
      traces.forEach(trace => drawTrace(trace, time));
      drawFragments(time);
      if (logoReady) {
        // Protect actual letter shapes, including their floating envelope, rather than cutting a hard box through the ink.
        context.globalCompositeOperation = 'destination-out';
        context.globalAlpha = 1;
        context.shadowColor = '#000';
        context.shadowBlur = 5;
        for (const offset of [-10, -4, 3]) context.drawImage(logo, brand.x, brand.y + offset, brand.width, brand.height);
      }
      context.restore();
      context.globalAlpha = 1;
    }

    function stopFrame() {
      if (frame !== null) cancelFrame(frame);
      frame = null;
      lastMotionTick = null;
    }

    function schedule() {
      if (frame === null && active() && !reduced && (hasTextures() || (loading && displayed < target))) {
        frame = requestFrame(tick);
      }
    }

    function tick(timestamp) {
      frame = null;
      if (!active() || reduced) return;
      if (lastMotionTick !== null) motionTime += Math.min(100, Math.max(0, timestamp - lastMotionTick));
      lastMotionTick = timestamp;
      if (loading && displayed < target) {
        const fraction = Math.min(1, Math.max(0, (timestamp - progressStart) / 220));
        displayed = progressFrom + (target - progressFrom) * (1 - (1 - fraction) ** 3);
        if (fraction === 1) displayed = target;
        paintProgress();
      }
      if (geometryDirty || timestamp - lastDraw >= 1000 / (geometry?.mobile ? 20 : 30)) {
        drawInk(motionTime);
        lastDraw = timestamp;
      }
      schedule();
    }

    function syncActivity() {
      screen?.classList.toggle('login-art-paused', !active());
      screen?.classList.toggle('login-art-reduced', reduced);
      if (reduced) {
        cancelBackdropDeadline();
        backdropReady = true;
        logoAnimation?.cancel();
        logoAnimation = null;
        if (revealed) revealComplete = true;
        floatAnimation?.cancel();
        floatAnimation = null;
        rippleAnimation?.cancel();
        rippleAnimation = null;
        context?.clearRect(0, 0, canvas.width, canvas.height);
        displayed = target;
        paintProgress();
      }
      if (!active() || reduced) { stopFrame(); cancelSettling(); }
      else { loadTextures(); schedule(); }
      if (active()) {
        logoAnimation?.play();
        floatAnimation?.play();
        requestLogoReveal();
        floatLogo();
      } else {
        logoAnimation?.pause();
        floatAnimation?.pause();
        rippleAnimation?.cancel();
        rippleAnimation = null;
      }
    }

    function pulse() {
      const timestamp = now();
      if (!active() || reduced || loading || timestamp - lastPulse < 160
          || typeof ripple?.animate !== 'function') return;
      lastPulse = timestamp;
      rippleAnimation?.cancel();
      rippleAnimation = ripple.animate([
        { opacity: 0.24, transform: 'scale(.98)' },
        { opacity: 0, transform: 'scale(1.045)' },
      ], { duration: 420, easing: 'cubic-bezier(.2,.65,.35,1)' });
    }

    function clearTouchGlow() {
      if (touchGlowTimer !== null) clearTimer(touchGlowTimer);
      touchGlowTimer = null;
      button?.classList.toggle('login-submit-touch-glow', false);
    }

    const onPointer = (event = {}) => {
      if (button.disabled || (event.button !== undefined && event.button !== 0)) return;
      if (event.pointerType === 'touch' || event.pointerType === 'pen') {
        clearTouchGlow();
        button.classList.add('login-submit-touch-glow');
        touchGlowTimer = setTimer(clearTouchGlow, 250);
      }
      pulse();
    };
    const onMedia = event => { reduced = event.matches; syncActivity(); };
    const onVisibility = () => syncActivity();
    const onResize = () => {
      geometryDirty = true;
      if (!revealed) { cancelSettling(); requestLogoReveal(); }
      schedule();
    };

    function init() {
      if (started || destroyed || !screen) return;
      started = true;
      screen.classList.add('login-art-ready');
      if (logo) {
        logo.style.visibility = 'hidden';
        logo.addEventListener('load', onLogoLoad);
        logo.addEventListener('error', onLogoError);
        if (logo.complete) {
          if (logo.naturalWidth > 0) onLogoLoad();
          else onLogoError();
        }
      }
      loadBackdrop();
      initButtonArtwork();
      button?.addEventListener('pointerdown', onPointer);
      form?.addEventListener('submit', pulse);
      doc.addEventListener('visibilitychange', onVisibility);
      host.addEventListener?.('resize', onResize);
      media?.addEventListener?.('change', onMedia);
      if (typeof host.ResizeObserver === 'function') {
        resizeObserver = new host.ResizeObserver(onResize);
        resizeObserver.observe(screen);
        if (form?.parentElement) resizeObserver.observe(form.parentElement);
      }
      if (typeof host.IntersectionObserver === 'function') {
        observer = new host.IntersectionObserver(entries => {
          intersecting = entries.some(entry => entry.isIntersecting);
          syncActivity();
        });
        observer.observe(screen);
      }
      paintProgress();
      syncActivity();
    }

    function setLoading(nextLoading, percent = 0) {
      const clamped = Math.min(100, Math.max(0, Number(percent) || 0));
      // Duplicate loader notifications must not keep restarting the same tween.
      if (loading && nextLoading && clamped <= target) return;
      if (!nextLoading || !loading) {
        target = 0;
        displayed = 0;
      }
      if (loading !== Boolean(nextLoading)) geometryDirty = true;
      loading = Boolean(nextLoading);
      screen?.classList.toggle('login-art-loading', loading);
      progressFrom = displayed;
      target = loading ? Math.max(target, clamped) : 0;
      progressStart = now();
      if (reduced || !active()) displayed = target;
      paintProgress();
      schedule();
    }

    function setVisible(nextVisible) {
      visible = Boolean(nextVisible);
      if (!visible) clearTouchGlow();
      syncActivity();
    }

    function destroy() {
      destroyed = true;
      stopFrame();
      cancelSettling();
      cancelBackdropDeadline();
      clearTouchGlow();
      if (backdropImage) { backdropImage.onload = null; backdropImage.onerror = null; }
      logoAnimation?.cancel();
      floatAnimation?.cancel();
      rippleAnimation?.cancel();
      observer?.disconnect();
      resizeObserver?.disconnect();
      imageRequests.forEach(image => { image.onload = null; image.onerror = null; });
      buttonArtwork.forEach(entry => {
        entry.image.removeEventListener('load', entry.onLoad);
        entry.image.removeEventListener('error', entry.onError);
      });
      textures.length = 0;
      logo?.removeEventListener('load', onLogoLoad);
      logo?.removeEventListener('error', onLogoError);
      button?.removeEventListener('pointerdown', onPointer);
      form?.removeEventListener('submit', pulse);
      doc.removeEventListener('visibilitychange', onVisibility);
      host.removeEventListener?.('resize', onResize);
      media?.removeEventListener?.('change', onMedia);
    }

    return { init, setLoading, setVisible, destroy };
  }

  let instance;
  const api = {
    create,
    getImageAssets() { return [...IMAGE_ASSETS]; },
    init(options) { instance?.destroy(); instance = create(options); instance.init(); return instance; },
    setLoading(loading, percent) { instance?.setLoading(loading, percent); },
    setVisible(visible) { instance?.setVisible(visible); },
  };
  root.LoginArt = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
