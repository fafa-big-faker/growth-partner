(function initLoginArt(root) {
  function create(options = {}) {
    const doc = options.document || root.document;
    const host = options.window || root;
    const requestFrame = options.requestAnimationFrame || host.requestAnimationFrame.bind(host);
    const cancelFrame = options.cancelAnimationFrame || host.cancelAnimationFrame.bind(host);
    const now = options.now || (() => host.performance.now());
    const screen = doc.getElementById('login-screen');
    const logo = doc.getElementById('login-brand-image');
    const fallback = doc.getElementById('login-brand-fallback');
    const canvas = doc.getElementById('login-ink-canvas');
    const bar = doc.getElementById('login-loading-bar');
    const label = doc.getElementById('login-loading-percent');
    const track = doc.getElementById('login-loading-track');
    const button = doc.getElementById('login-submit');
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
    let logoAnimation = null;
    let floatAnimation = null;
    let rippleAnimation = null;
    let observer = null;
    let resizeObserver = null;
    let geometryDirty = true;
    let geometry = null;
    let frame = null;
    let lastDraw = -Infinity;
    let lastPulse = -Infinity;
    let loading = false;
    let target = 0;
    let displayed = 0;
    let progressFrom = 0;
    let progressStart = 0;

    const active = () => !destroyed && visible && intersecting && !doc.hidden;

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
        { transform: 'translateY(-4px)' },
        { transform: 'translateY(0)' },
      ], { duration: 7200, iterations: Infinity, easing: 'ease-in-out' });
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

    function onLogoLoad() {
      logoReady = true;
      if (fallback) fallback.hidden = true;
      revealLogo();
    }

    function onLogoError() {
      logoReady = false;
      logoAnimation?.cancel();
      logoAnimation = null;
      floatAnimation?.cancel();
      floatAnimation = null;
      if (logo) logo.style.visibility = 'hidden';
      if (fallback) fallback.hidden = false;
    }

    function measureLake() {
      const bounds = screen?.getBoundingClientRect?.();
      const width = Math.max(1, bounds?.width || canvas.width || 960);
      const height = Math.max(1, bounds?.height || canvas.height || 720);
      const mobile = width < 600;
      const resolution = Math.min(host.devicePixelRatio || 1, mobile ? 1 : 1.5, 1600 / width, 1100 / height);
      canvas.width = Math.round(width * resolution);
      canvas.height = Math.round(height * resolution);
      context.setTransform(canvas.width / width, 0, 0, canvas.height / height, 0, 0);
      // The lake mask is authored against the 1448 x 1086 bitmap, then cover-cropped with it.
      const scale = Math.max(width / 1448, height / 1086);
      const offsetX = (width - 1448 * scale) / 2;
      const offsetY = (height - 1086 * scale) / 2;
      const point = (x, y) => [offsetX + x * 1448 * scale, offsetY + y * 1086 * scale];
      const lake = [
        [.34, .60], [.66, .58], [.78, .62], [.85, .64], [.73, .68],
        [.83, .72], [.87, .76], [.84, .98], [.18, .98], [.37, .89],
        [.32, .86], [.17, .78], [.19, .68],
      ].map(([x, y]) => point(x, y));
      const exclusions = [logo, form?.parentElement || form].map(element => {
        const rect = element?.getBoundingClientRect?.();
        if (!rect?.width || !rect?.height) return null;
        return [rect.left - (bounds?.left || 0) - 12, rect.top - (bounds?.top || 0) - 12,
          rect.width + 24, rect.height + 24];
      }).filter(Boolean);
      geometry = { width, height, mobile, point, lake, exclusions, scale };
      geometryDirty = false;
    }

    function drawInk(timestamp) {
      if (!context || !canvas) return;
      if (geometryDirty || !geometry) measureLake();
      const { width, height, point, lake, exclusions, scale } = geometry;
      const phase = timestamp / 5300;
      context.clearRect(0, 0, width, height);
      context.save();
      context.beginPath();
      context.moveTo(...lake[0]);
      lake.slice(1).forEach(position => context.lineTo(...position));
      context.closePath();
      context.clip();
      context.beginPath();
      context.rect(0, 0, width, height);
      exclusions.forEach(rect => context.rect(...rect));
      context.clip('evenodd');
      context.strokeStyle = '#567b7b';
      context.lineCap = 'round';

      const strokes = [[.34, .64, .11], [.58, .67, .12], [.23, .73, .16],
        [.63, .78, .13], [.40, .85, .20], [.59, .93, .15], [.30, .96, .14]];
      strokes.forEach(([sourceX, sourceY, lengthRatio], band) => {
        const [x, y] = point(sourceX, sourceY);
        const length = 1448 * scale * lengthRatio;
        const drift = Math.sin(phase + band * 1.8) * 6 * scale;
        for (let strand = 0; strand < 2; strand++) {
          const baseline = y + strand * 3 * scale + Math.sin(phase * .8 + band) * 1.3 * scale;
          context.globalAlpha = (strand ? .08 : .14) + Math.sin(phase + band) * .025;
          context.lineWidth = strand ? .65 : 1.05;
          context.beginPath();
          context.moveTo(x + drift, baseline);
          context.bezierCurveTo(x + length * .3 + drift, baseline - 1.4 * scale,
            x + length * .7 + drift, baseline + 1.4 * scale, x + length + drift, baseline);
          context.stroke();
        }
      });

      [[.38, .76, 0], [.68, .87, 6400]].forEach(([sourceX, sourceY, delay]) => {
        const age = ((timestamp + delay) % 16000) / 6600;
        if (age >= 1) return;
        const [x, y] = point(sourceX, sourceY);
        for (let ring = 0; ring < 2; ring++) {
          const expansion = age - ring * .17;
          if (expansion <= 0) continue;
          const radius = (10 + 61 * expansion) * scale;
          context.globalAlpha = Math.sin(Math.PI * expansion) * .18;
          context.lineWidth = .8;
          context.beginPath();
          context.ellipse(x, y, radius, radius * .115, 0, 0, Math.PI * 2);
          context.stroke();
        }
      });
      context.restore();
      context.globalAlpha = 1;
    }

    function stopFrame() {
      if (frame !== null) cancelFrame(frame);
      frame = null;
    }

    function schedule() {
      if (frame === null && active() && !reduced && (context || (loading && displayed < target))) {
        frame = requestFrame(tick);
      }
    }

    function tick(timestamp) {
      frame = null;
      if (!active() || reduced) return;
      if (loading && displayed < target) {
        const fraction = Math.min(1, Math.max(0, (timestamp - progressStart) / 220));
        displayed = progressFrom + (target - progressFrom) * (1 - (1 - fraction) ** 3);
        if (fraction === 1) displayed = target;
        paintProgress();
      }
      if (geometryDirty || timestamp - lastDraw >= 1000 / (geometry?.mobile ? 20 : 30)) {
        drawInk(timestamp);
        lastDraw = timestamp;
      }
      schedule();
    }

    function syncActivity() {
      screen?.classList.toggle('login-art-paused', !active());
      screen?.classList.toggle('login-art-reduced', reduced);
      if (reduced) {
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
      if (!active() || reduced) stopFrame();
      else schedule();
      if (active()) {
        logoAnimation?.play();
        floatAnimation?.play();
        revealLogo();
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
        { opacity: 0.38, transform: 'scale(.45)' },
        { opacity: 0, transform: 'scale(1.3)' },
      ], { duration: 420, easing: 'cubic-bezier(.2,.65,.35,1)' });
    }

    const onPointer = event => { if (!button.disabled && (event.button === undefined || event.button === 0)) pulse(); };
    const onMedia = event => { reduced = event.matches; syncActivity(); };
    const onVisibility = () => syncActivity();
    const onResize = () => { geometryDirty = true; schedule(); };

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
      syncActivity();
    }

    function destroy() {
      destroyed = true;
      stopFrame();
      logoAnimation?.cancel();
      floatAnimation?.cancel();
      rippleAnimation?.cancel();
      observer?.disconnect();
      resizeObserver?.disconnect();
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
    init(options) { instance?.destroy(); instance = create(options); instance.init(); return instance; },
    setLoading(loading, percent) { instance?.setLoading(loading, percent); },
    setVisible(visible) { instance?.setVisible(visible); },
  };
  root.LoginArt = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
