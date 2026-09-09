(function (root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.FirstChopGuide = api.createController();
})(typeof globalThis === 'undefined' ? window : globalThis, function (root) {
  'use strict';

  const TITLE_ID = 'first-chop-guide-title';
  const DESCRIPTION_ID = 'first-chop-guide-description';
  const INPUT_EVENTS = ['click', 'dblclick', 'auxclick', 'pointerdown', 'pointerup', 'mousedown',
    'mouseup', 'touchstart', 'touchend', 'touchmove', 'wheel', 'keydown', 'keyup', 'contextmenu',
    'dragstart', 'selectstart', 'submit', 'change', 'input'];

  function shouldStart({ role, environment, totalChops } = {}) {
    return role === 'player' && environment === 'live'
      && ['number', 'string'].includes(typeof totalChops) && String(totalChops).trim() !== ''
      && Number.isFinite(Number(totalChops)) && Number(totalChops) === 0;
  }

  function createController(dependencies = {}) {
    const host = dependencies.window || root;
    const doc = dependencies.document || host.document;
    const schedule = dependencies.setTimeout || host.setTimeout?.bind(host);
    const cancelSchedule = dependencies.clearTimeout || host.clearTimeout?.bind(host);
    const requestFrame = dependencies.requestAnimationFrame || host.requestAnimationFrame?.bind(host)
      || (callback => schedule(callback, 16));
    const cancelFrame = dependencies.cancelAnimationFrame || host.cancelAnimationFrame?.bind(host) || cancelSchedule;
    const Observer = dependencies.ResizeObserver || host.ResizeObserver;
    const motion = host.matchMedia?.('(prefers-reduced-motion: reduce)');
    const listeners = [];
    let active = false, pending = false, backgrounded = false, generation = 0, options;
    let overlay, hole, bubble, target, targetState, previousFocus, observer;
    let frame = null, revealTimer = null, focusing = false, addedScrollLock = false;

    function listen(surface, name, callback, capture = false) {
      if (!surface?.addEventListener) return;
      const settings = capture ? { capture: true, passive: false } : false;
      surface.addEventListener(name, callback, settings);
      listeners.push(() => surface.removeEventListener(name, callback, settings));
    }

    function current() {
      try { return options?.isCurrent?.() !== false; } catch { return false; }
    }

    function hidden() { return Boolean(backgrounded || doc?.hidden); }

    function cancelReveal() {
      if (frame !== null) cancelFrame(frame);
      if (revealTimer !== null) cancelSchedule(revealTimer);
      frame = revealTimer = null;
    }

    function restoreTarget() {
      if (!target || !targetState) return;
      if (targetState.description === null) target.removeAttribute('aria-describedby');
      else target.setAttribute('aria-describedby', targetState.description);
      if (!targetState.hadClass) target.classList.remove('first-chop-guide-target');
      targetState = null;
    }

    function bindTarget(next) {
      if (next === target) return;
      restoreTarget();
      observer?.disconnect();
      target = next;
      targetState = { description: target.getAttribute('aria-describedby'),
        hadClass: target.classList.contains('first-chop-guide-target') };
      target.setAttribute('aria-describedby', [targetState.description, TITLE_ID, DESCRIPTION_ID].filter(Boolean).join(' '));
      target.classList.add('first-chop-guide-target');
      if (target.id) overlay.setAttribute('aria-owns', target.id);
      else overlay.removeAttribute('aria-owns');
      observer?.observe(target);
      const axe = target.querySelector('.chop-axe-icon');
      if (axe) observer?.observe(axe);
    }

    function focusTarget() {
      if (!active || hidden() || focusing) return;
      const destination = target?.isConnected && !target.disabled ? target : overlay;
      if (doc.activeElement === destination) return;
      focusing = true;
      try { destination?.focus({ preventScroll: true }); } finally { focusing = false; }
    }

    function position() {
      if (!active) return false;
      if (!current()) { destroy(); return false; }
      let next;
      try { next = options.getTarget(); } catch { destroy(); return false; }
      if (!next?.isConnected) {
        if (!pending) destroy();
        return false;
      }
      bindTarget(next);
      if (!pending && target.disabled) { destroy(); return false; }
      const boxes = [target, target.querySelector('.chop-axe-icon'), target.querySelector('.chop-axe-icon img')]
        .filter(Boolean).map(element => element.getBoundingClientRect())
        .filter(rect => rect.width > 0 && rect.height > 0);
      if (!boxes.length) { if (!pending) destroy(); return false; }
      const unionLeft = Math.min(...boxes.map(rect => rect.left));
      const unionTop = Math.min(...boxes.map(rect => rect.top));
      const unionRight = Math.max(...boxes.map(rect => rect.right));
      const unionBottom = Math.max(...boxes.map(rect => rect.bottom));
      const centerX = (unionLeft + unionRight) / 2, centerY = (unionTop + unionBottom) / 2;
      // The full diagonal encloses even the axe's protruding bitmap corners.
      const radius = Math.hypot(unionRight - unionLeft, unionBottom - unionTop) / 2 + 10;
      const left = centerX - radius, top = centerY - radius;
      const right = centerX + radius, bottom = centerY + radius;
      Object.assign(hole.style, { left: `${left}px`, top: `${top}px`, width: `${right - left}px`, height: `${bottom - top}px` });
      const viewport = host.visualViewport;
      const x = viewport?.offsetLeft || 0, y = viewport?.offsetTop || 0;
      const width = viewport?.width || host.innerWidth || doc.documentElement.clientWidth;
      const height = viewport?.height || host.innerHeight || doc.documentElement.clientHeight;
      const bubbleWidth = Math.min(288, Math.max(1, width - 24));
      bubble.style.width = `${bubbleWidth}px`;
      const bubbleHeight = bubble.getBoundingClientRect().height || 88;
      const bubbleLeft = Math.max(x + 12, Math.min(x + width - bubbleWidth - 12, (left + right - bubbleWidth) / 2));
      const above = top - bubbleHeight - 18;
      const fitsBelow = bottom + bubbleHeight + 18 <= y + height - 17;
      const bubbleTop = above >= y + 17 || !fitsBelow ? above : bottom + 18;
      bubble.dataset.placement = above >= y + 17 || !fitsBelow ? 'above' : 'below';
      Object.assign(bubble.style, { left: `${bubbleLeft}px`,
        top: `${Math.max(y + 17, Math.min(y + height - bubbleHeight - 17, bubbleTop))}px` });
      return true;
    }

    function requestPosition() {
      if (!active || hidden() || frame !== null) return;
      frame = requestFrame(() => { frame = null; position(); });
    }

    function reveal() {
      cancelReveal();
      if (!active || pending) return;
      overlay.classList.remove('is-pending', 'is-visible', 'is-ready');
      overlay.dataset.phase = 'preparing';
      if (hidden()) return;
      const token = generation;
      frame = requestFrame(() => {
        frame = requestFrame(() => {
          frame = null;
          if (!active || token !== generation || !position()) return;
          overlay.classList.add('is-visible');
          overlay.dataset.phase = 'spotlight';
          focusTarget();
          const showBubble = () => {
            revealTimer = null;
            if (!active || pending || token !== generation || hidden()) return;
            if (!current()) { destroy(); return; }
            overlay.classList.add('is-ready');
            overlay.dataset.phase = 'ready';
          };
          if (motion?.matches) showBubble();
          else revealTimer = schedule(showBubble, 300);
        });
      });
    }

    function syncVisibility() {
      if (!active) return;
      if (!current()) { destroy(); return; }
      overlay.classList.toggle('is-paused', hidden());
      if (hidden()) cancelReveal();
      else if (!pending && !overlay.classList.contains('is-ready')) reveal();
      else { position(); focusTarget(); }
    }

    function syncMotion() {
      overlay?.classList.toggle('is-reduced', Boolean(motion?.matches));
      if (motion?.matches && active && !pending && !hidden()) {
        cancelReveal();
        if (position()) {
          overlay.classList.add('is-visible', 'is-ready');
          overlay.dataset.phase = 'ready';
          focusTarget();
        }
      }
    }

    function block(event) {
      event.preventDefault?.();
      event.stopImmediatePropagation?.();
      event.stopPropagation?.();
    }

    function submitChop() {
      if (!active || pending || hidden() || !position() || target.disabled) return;
      pending = true;
      cancelReveal();
      overlay.classList.add('is-pending');
      overlay.dataset.phase = 'pending';
      overlay.setAttribute('aria-busy', 'true');
      const token = generation, attempt = options;
      Promise.resolve().then(() => active && token === generation && current() ? attempt.onChop() : false)
        .catch(() => false).then(success => {
          if (!active || token !== generation) return;
          if (!current() || success === true) { destroy(); return; }
          pending = false;
          overlay.removeAttribute('aria-busy');
          // doChop can redraw the bottom bar even when its request fails.
          if (position()) reveal();
        });
    }

    function guardInput(event) {
      if (!active) return;
      if (!current()) { destroy(); return; }
      const inside = target?.isConnected && (event.target === target || target.contains(event.target));
      if (event.type === 'keydown') {
        block(event);
        if (!pending && !event.repeat && inside && (event.key === 'Enter' || event.key === ' ')) submitChop();
        else if (event.key === 'Tab') focusTarget();
        return;
      }
      if (event.type === 'click') {
        block(event);
        if (inside && !event.button) submitChop();
        return;
      }
      const nativePress = ['pointerdown', 'pointerup', 'mousedown', 'mouseup', 'touchstart', 'touchend'].includes(event.type);
      if (pending || !inside || !nativePress) block(event);
    }

    function guardFocus(event) {
      if (!active || focusing) return;
      if (!current()) { destroy(); return; }
      if (event.target !== target && event.target !== overlay) {
        event.stopImmediatePropagation?.();
        focusTarget();
      }
    }

    function destroy() {
      if (!active && !overlay) return;
      const ownedFocus = doc.activeElement === target || doc.activeElement === overlay || doc.activeElement === doc.body;
      active = pending = false;
      generation++;
      cancelReveal();
      listeners.splice(0).forEach(remove => remove());
      observer?.disconnect();
      observer = null;
      restoreTarget();
      overlay?.remove();
      if (addedScrollLock) doc.documentElement.classList.remove('first-chop-guide-open');
      addedScrollLock = false;
      const restoreFocus = previousFocus;
      overlay = hole = bubble = target = previousFocus = options = null;
      const visibleModal = [...(doc.querySelectorAll?.('.modal-overlay') || [])].reverse().find(modal => {
        const bounds = modal.getBoundingClientRect();
        return modal.isConnected && !modal.hidden && bounds.width > 0 && bounds.height > 0;
      });
      if (ownedFocus && !hidden() && visibleModal) {
        visibleModal.querySelector('button:not(:disabled), [href], [tabindex]:not([tabindex="-1"])')?.focus?.({ preventScroll: true });
      } else if (ownedFocus && !hidden() && restoreFocus?.isConnected && !restoreFocus.disabled) {
        const bounds = restoreFocus.getBoundingClientRect?.();
        if (!bounds || bounds.width > 0 && bounds.height > 0) restoreFocus.focus?.({ preventScroll: true });
      }
    }

    function start(settings = {}) {
      if (active || !doc?.body || typeof settings.getTarget !== 'function' || typeof settings.onChop !== 'function') return false;
      options = settings;
      if (!current()) { options = null; return false; }
      let button;
      try { button = settings.getTarget(); } catch { options = null; return false; }
      if (!button?.isConnected || button.disabled) { options = null; return false; }
      active = true;
      generation++;
      previousFocus = doc.activeElement;
      overlay = doc.createElement('div');
      overlay.className = 'first-chop-guide';
      overlay.setAttribute('role', 'dialog');
      overlay.setAttribute('aria-modal', 'true');
      overlay.setAttribute('aria-labelledby', TITLE_ID);
      overlay.setAttribute('aria-describedby', DESCRIPTION_ID);
      overlay.setAttribute('tabindex', '-1');
      hole = doc.createElement('div');
      hole.className = 'first-chop-guide-hole';
      hole.setAttribute('aria-hidden', 'true');
      const ring = doc.createElement('div');
      ring.className = 'first-chop-guide-ring';
      hole.appendChild(ring);
      bubble = doc.createElement('div');
      bubble.className = 'first-chop-guide-bubble';
      const paper = doc.createElement('div');
      paper.className = 'first-chop-guide-paper';
      const title = doc.createElement('strong');
      title.id = TITLE_ID;
      title.textContent = '点一下仙斧，开始砍树';
      const description = doc.createElement('span');
      description.id = DESCRIPTION_ID;
      description.textContent = '每次砍树都能获得奖励';
      paper.append(title, description);
      bubble.appendChild(paper);
      overlay.append(hole, bubble);
      doc.body.appendChild(overlay);
      addedScrollLock = !doc.documentElement.classList.contains('first-chop-guide-open');
      doc.documentElement.classList.add('first-chop-guide-open');
      if (Observer) observer = new Observer(requestPosition);
      bindTarget(button);
      for (const surface of new Set([host, doc])) {
        INPUT_EVENTS.forEach(name => listen(surface, name, guardInput, true));
        listen(surface, 'focusin', guardFocus, true);
      }
      listen(host, 'resize', requestPosition);
      listen(host, 'orientationchange', requestPosition);
      listen(host, 'scroll', requestPosition, true);
      listen(host.visualViewport, 'resize', requestPosition);
      listen(host.visualViewport, 'scroll', requestPosition);
      listen(doc, 'visibilitychange', syncVisibility);
      listen(motion, 'change', syncMotion);
      syncMotion();
      syncVisibility();
      if (!motion?.matches && !hidden()) reveal();
      return active;
    }

    return { shouldStart, start, isActive: () => active, destroy,
      setBackgrounded(value) { backgrounded = Boolean(value); syncVisibility(); } };
  }

  return { createController, shouldStart };
});
