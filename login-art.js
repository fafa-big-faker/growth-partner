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

    function visibleLakeSegments(lake, exclusions, width, y, padding) {
      let segments = [[12, width - 12]];
      // Intersect three horizontal cuts so each ripple fits wholly inside the visible water.
      for (const scanY of [y - padding, y, y + padding]) {
        const crossings = [];
        lake.forEach(([x1, y1], index) => {
          const [x2, y2] = lake[(index + 1) % lake.length];
          if ((y1 > scanY) !== (y2 > scanY)) crossings.push(x1 + (scanY - y1) * (x2 - x1) / (y2 - y1));
        });
        crossings.sort((a, b) => a - b);
        const next = [];
        for (let index = 0; index + 1 < crossings.length; index += 2) {
          for (const [left, right] of segments) {
            const start = Math.max(left, crossings[index] + 4);
            const end = Math.min(right, crossings[index + 1] - 4);
            if (end - start >= 48) next.push([start, end]);
          }
        }
        segments = next;
      }
      for (const [x, top, exclusionWidth, exclusionHeight] of exclusions) {
        if (y + padding < top || y - padding > top + exclusionHeight) continue;
        segments = segments.flatMap(([left, right]) => {
          if (right <= x || left >= x + exclusionWidth) return [[left, right]];
          return [[left, Math.min(right, x)], [Math.max(left, x + exclusionWidth), right]]
            .filter(([start, end]) => end - start >= 48);
        });
      }
      return segments;
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
        const margin = element === logo ? 24 : 12;
        return [rect.left - (bounds?.left || 0) - margin, rect.top - (bounds?.top || 0) - margin,
          rect.width + margin * 2, rect.height + margin * 2];
      }).filter(Boolean);
      const waterTop = Math.max(12, Math.min(...lake.map(position => position[1])) + 14);
      const waterBottom = Math.min(height - 12, Math.max(...lake.map(position => position[1])) - 14);
      const bands = [];
      const rippleCandidates = [];
      const bandCount = Math.max(2, Math.floor((waterBottom - waterTop) / 22));
      for (let band = 0; band <= bandCount; band++) {
        const y = waterTop + (waterBottom - waterTop) * band / bandCount;
        for (const [left, right] of visibleLakeSegments(lake, exclusions, width, y, 5)) {
          bands.push({ x: left + 10, y, length: Math.min(right - left - 20, mobile ? 178 : 235) });
        }
        for (const [left, right] of visibleLakeSegments(lake, exclusions, width, y, 12)) {
          const span = right - left;
          if (span < 90) continue;
          const positions = span > 260 ? [.25, .75] : [.5];
          const radius = Math.min(mobile ? 76 : 96, span * (positions.length > 1 ? .22 : .42));
          positions.forEach(position => rippleCandidates.push({ x: left + span * position, y, radius, span }));
        }
      }
      const strokeCount = Math.min(bands.length, mobile ? 9 : 12);
      const strokes = Array.from({ length: strokeCount }, (_, index) =>
        bands[Math.floor(index * bands.length / strokeCount)]);
      rippleCandidates.sort((a, b) => b.span - a.span);
      const ripples = [];
      for (const candidate of rippleCandidates) {
        if (ripples.every(existing => Math.abs(existing.y - candidate.y) > 35
            || Math.abs(existing.x - candidate.x) > existing.radius + candidate.radius + 8)) {
          ripples.push(candidate);
          if (ripples.length === 2) break;
        }
      }
      geometry = { width, height, mobile, lake, exclusions, strokes, ripples };
      geometryDirty = false;
    }

    function drawInk(timestamp) {
      if (!context || !canvas) return;
      if (geometryDirty || !geometry) measureLake();
      const { width, height, lake, exclusions, strokes, ripples } = geometry;
      const phase = timestamp / 2400;
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
      context.strokeStyle = '#42656b';
      context.lineCap = 'round';

      strokes.forEach(({ x, y, length }, band) => {
        const drift = Math.sin(phase + band * 1.8) * 7;
        for (let strand = 0; strand < 2; strand++) {
          const baseline = y + strand * 3 + Math.sin(phase * .8 + band) * 1.5;
          context.globalAlpha = (strand ? .18 : .29) + Math.sin(phase + band) * .045;
          context.lineWidth = strand ? 1.15 : 1.7;
          context.beginPath();
          context.moveTo(x + drift, baseline);
          context.bezierCurveTo(x + length * .3 + drift, baseline - 1.5,
            x + length * .7 + drift, baseline + 1.5, x + length + drift, baseline);
          context.stroke();
        }
      });

      ripples.forEach(({ x, y, radius: maximumRadius }, index) => {
        const age = ((timestamp + 1100 + index * 3100) % 6200) / 5200;
        if (age >= 1) return;
        for (let ring = 0; ring < 2; ring++) {
          const expansion = age - ring * .17;
          if (expansion <= 0) continue;
          const radius = 8 + (maximumRadius - 8) * expansion;
          context.globalAlpha = Math.sin(Math.PI * expansion) * .36;
          context.lineWidth = 1.55;
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
