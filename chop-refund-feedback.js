(function initChopRefundFeedback(root) {
  const MAX_ROWS = 4;
  const ROW_HEIGHT = 24;
  const ROW_STEP = 28;
  const LIFETIME_MS = 1600;
  const FADE_MS = 280;
  const SOUND_INTERVAL_MS = 350;
  const SOUND_GROUP = 'chop-refunds';

  function create(options = {}) {
    const doc = options.document || root.document;
    const host = options.window || root;
    const now = options.now || (() => host.performance.now());
    const schedule = options.setTimeout || host.setTimeout.bind(host);
    const cancelSchedule = options.clearTimeout || host.clearTimeout.bind(host);
    const requestFrame = options.requestAnimationFrame || host.requestAnimationFrame.bind(host);
    const cancelFrame = options.cancelAnimationFrame || host.cancelAnimationFrame.bind(host);
    const motion = host.matchMedia?.('(prefers-reduced-motion: reduce)');
    const rows = [];
    const soundManagers = new Set();
    let feed;
    let anchor;
    let frame = null;
    let bound = false;
    let lastSound = -Infinity;
    let lastPosition = '';

    function clearRow(row) {
      row.timers.forEach(cancelSchedule);
      row.timers.length = 0;
      row.element.remove();
    }

    function syncRows() {
      rows.forEach((row, index) => {
        row.element.style.setProperty('--refund-offset', `${-index * ROW_STEP}px`);
      });
    }

    function release(row) {
      const index = rows.indexOf(row);
      if (index < 0) return;
      rows.splice(index, 1);
      clearRow(row);
      if (!rows.length) clear();
      else syncRows();
    }

    function clear() {
      if (frame !== null) cancelFrame(frame);
      frame = null;
      rows.splice(0).forEach(clearRow);
      feed?.remove();
      feed = null;
      anchor = null;
      lastPosition = '';
      lastSound = -Infinity;
      if (bound) {
        doc.removeEventListener('visibilitychange', onVisibility);
        host.removeEventListener('scroll', position, true);
        host.removeEventListener('resize', position);
        host.visualViewport?.removeEventListener('scroll', position);
        host.visualViewport?.removeEventListener('resize', position);
        motion?.removeEventListener?.('change', syncMotion);
        bound = false;
      }
      soundManagers.forEach(audio => {
        try { audio.stopEffects?.(SOUND_GROUP); } catch { /* Optional feedback cannot affect chopping. */ }
      });
      soundManagers.clear();
    }

    function onVisibility() {
      if (doc.hidden) clear();
    }

    function syncMotion() {
      const reduced = typeof options.reducedMotion === 'function'
        ? options.reducedMotion() : (options.reducedMotion ?? motion?.matches ?? false);
      feed?.classList.toggle('chop-refund-reduced', reduced);
    }

    function position() {
      if (!feed || !anchor) return;
      if (doc.hidden || !anchor.isConnected) { clear(); return; }
      const bounds = anchor.getBoundingClientRect();
      if (!bounds.width || !bounds.height) { clear(); return; }
      const viewport = host.visualViewport;
      const width = viewport?.width || host.innerWidth || doc.documentElement.clientWidth;
      const height = viewport?.height || host.innerHeight || doc.documentElement.clientHeight;
      const originX = viewport?.offsetLeft || 0;
      const originY = viewport?.offsetTop || 0;
      if (bounds.bottom <= originY || bounds.top >= originY + height
          || bounds.right <= originX || bounds.left >= originX + width) { clear(); return; }
      const feedWidth = Math.max(1, Math.min(280, width - 16));
      const left = Math.max(originX + 8, Math.min(originX + width - feedWidth - 8,
        bounds.left + bounds.width / 2 - feedWidth / 2));
      const bottom = bounds.top - 10;
      const available = Math.max(0, bottom - originY - 8);
      const visibleRows = Math.min(MAX_ROWS, Math.floor((available + ROW_STEP - ROW_HEIGHT) / ROW_STEP));
      // Clip only offscreen rows when the anchor approaches the top edge.
      const current = `${left}:${bottom}:${feedWidth}:${visibleRows}`;
      if (current !== lastPosition) {
        feed.style.left = `${left}px`;
        feed.style.top = `${bottom}px`;
        feed.style.width = `${feedWidth}px`;
        feed.style.setProperty('--refund-visible-height', `${Math.max(0, visibleRows) * ROW_STEP}px`);
        feed.style.visibility = visibleRows > 0 ? 'visible' : 'hidden';
        lastPosition = current;
      }
    }

    function tick() {
      frame = null;
      position();
      if (feed && rows.length) frame = requestFrame(tick);
    }

    function mount(button) {
      anchor = button;
      feed = doc.createElement('div');
      feed.className = 'chop-refund-feed';
      feed.setAttribute('role', 'status');
      feed.setAttribute('aria-live', 'polite');
      feed.setAttribute('aria-relevant', 'additions');
      doc.body.appendChild(feed);
      doc.addEventListener('visibilitychange', onVisibility);
      host.addEventListener('scroll', position, true);
      host.addEventListener('resize', position);
      host.visualViewport?.addEventListener('scroll', position);
      host.visualViewport?.addEventListener('resize', position);
      motion?.addEventListener?.('change', syncMotion);
      bound = true;
      syncMotion();
      position();
    }

    function playCue(audio) {
      const time = now();
      if (!audio?.playEffect || time - lastSound < SOUND_INTERVAL_MS) return;
      lastSound = time;
      soundManagers.add(audio);
      try {
        audio.stopEffects?.(SOUND_GROUP);
        const result = audio.playEffect('skillTrigger', { group: SOUND_GROUP, volumeScale: .8 });
        result?.catch?.(() => {});
      } catch { /* Optional audio never changes the chop timeline. */ }
    }

    function show(button, count, settings = {}) {
      const quantity = Math.floor(Number(count));
      if (!Number.isSafeInteger(quantity) || quantity <= 0 || !button?.isConnected || doc?.hidden || !doc?.body) return false;
      if (anchor && anchor !== button) clear();
      if (!feed) mount(button);
      else position();
      if (!feed) return false;
      while (rows.length >= MAX_ROWS) clearRow(rows.pop());
      const element = doc.createElement('div');
      element.className = `chop-refund-row${rows.length ? ' chop-refund-followup' : ''}`;
      const copy = doc.createElement('span');
      copy.className = 'chop-refund-copy';
      const label = doc.createElement('span');
      label.textContent = '\u65a7\u6280\u53d1\u52a8\uff1a\u8fd4\u8fd8';
      const value = doc.createElement('strong');
      value.className = 'chop-refund-count';
      value.textContent = String(quantity);
      const suffix = doc.createElement('span');
      suffix.textContent = '\u6b21';
      copy.append(label, value, suffix);
      element.appendChild(copy);
      feed.appendChild(element);
      const row = { element, timers: [] };
      rows.unshift(row);
      syncRows();
      row.timers.push(schedule(() => element.classList.add('chop-refund-leaving'), LIFETIME_MS - FADE_MS));
      row.timers.push(schedule(() => release(row), LIFETIME_MS));
      if (frame === null) frame = requestFrame(tick);
      playCue(settings.audio);
      return true;
    }

    return { show, clear };
  }

  let instance;
  const api = {
    create,
    show(button, count, options) { instance ||= create(); return instance.show(button, count, options); },
    clear() { instance?.clear(); },
  };
  root.ChopRefundFeedback = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
