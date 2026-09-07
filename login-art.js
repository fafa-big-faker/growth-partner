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
    let logoAnimation = null;
    let rippleAnimation = null;
    let observer = null;
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
    }

    function revealLogo() {
      if (!logoReady || revealed || !active()) return;
      revealed = true;
      logo.style.visibility = 'visible';
      if (reduced || typeof logo.animate !== 'function') return;
      logoAnimation = logo.animate([
        { opacity: 0, clipPath: 'polygon(0 0, 0 0, 0 22%, 0 44%, 0 70%, 0 100%, 0 100%)', transform: 'translateY(3px)' },
        { opacity: 0.85, clipPath: 'polygon(0 0, 65% 0, 56% 22%, 69% 44%, 49% 70%, 43% 100%, 0 100%)', offset: 0.55 },
        { opacity: 1, clipPath: 'polygon(0 0, 100% 0, 100% 22%, 100% 44%, 100% 70%, 100% 100%, 0 100%)', transform: 'translateY(0)' },
      ], { duration: 1500, easing: 'cubic-bezier(.22,.55,.28,1)', fill: 'both' });
      logoAnimation.onfinish = () => {
        const completed = logoAnimation;
        logoAnimation = null;
        completed?.cancel();
      };
    }

    function onLogoLoad() {
      logoReady = true;
      if (fallback) fallback.hidden = true;
      revealLogo();
    }

    function onLogoError() {
      if (logo) logo.style.visibility = 'hidden';
      if (fallback) fallback.hidden = false;
    }

    function drawInk(timestamp) {
      if (!context || !canvas) return;
      const width = canvas.width;
      const height = canvas.height;
      const phase = timestamp / 11000;
      context.clearRect(0, 0, width, height);
      context.strokeStyle = '#41645c';
      context.lineCap = 'round';
      // Narrow shoreline strokes leave the title and login controls unobscured.
      for (let side = 0; side < 2; side++) {
        for (let band = 0; band < 3; band++) {
          const x = width * (side ? 0.77 : 0.045);
          const y = height * (0.62 + band * 0.12) + Math.sin(phase + band * 1.7) * 3;
          const length = width * (0.12 + band * 0.025);
          const drift = Math.sin(phase * 1.5 + side * 2 + band) * 5;
          context.globalAlpha = 0.055 + (Math.sin(phase + band) + 1) * 0.018;
          for (let strand = 0; strand < 2; strand++) {
            context.lineWidth = strand ? 0.6 : 1.2;
            context.beginPath();
            context.moveTo(x + drift, y + strand * 3);
            context.bezierCurveTo(x + length * 0.3, y - 2, x + length * 0.7, y + 2, x + length, y + strand * 3);
            context.stroke();
          }
        }
      }
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
      if (timestamp - lastDraw >= 1000 / 30) {
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
        revealLogo();
      } else {
        logoAnimation?.pause();
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
      media?.addEventListener?.('change', onMedia);
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
      rippleAnimation?.cancel();
      observer?.disconnect();
      logo?.removeEventListener('load', onLogoLoad);
      logo?.removeEventListener('error', onLogoError);
      button?.removeEventListener('pointerdown', onPointer);
      form?.removeEventListener('submit', pulse);
      doc.removeEventListener('visibilitychange', onVisibility);
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
