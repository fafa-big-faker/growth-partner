(function (root, factory) {
  const api = factory({ document: root.document, window: root });
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.SceneTransition = api;
})(typeof window !== 'undefined' ? window : globalThis, function create(environment) {
  'use strict';

  environment = environment || {};
  const doc = environment.document;
  const win = environment.window || globalThis;
  const schedule = (callback, delay) => win.setTimeout(callback, delay);
  const unschedule = timer => win.clearTimeout(timer);
  let current = null;

  function begin() {
    let resolve, reject;
    const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
    const operation = { promise, resolve, reject, restores: [], animations: [], timer: null,
      settled: false, visual: false, commit: null, rollback: null };
    current = operation;
    return operation;
  }

  function lock(operation, node) {
    if (!node) return;
    const inert = node.inert;
    const alreadyLocked = node.classList.contains('scene-transition-locked');
    node.inert = true;
    node.classList.add('scene-transition-locked');
    operation.restores.push(() => {
      node.inert = inert;
      if (!alreadyLocked) node.classList.remove('scene-transition-locked');
    });
  }

  function addClass(operation, node, name) {
    if (!node || node.classList.contains(name)) return;
    node.classList.add(name);
    operation.restores.push(() => node.classList.remove(name));
  }

  function finish(operation, cancelled = false, error) {
    if (operation.settled) return;
    operation.settled = true;
    if (operation.timer !== null) unschedule(operation.timer);
    doc?.removeEventListener?.('visibilitychange', operation.onVisibility);
    for (const animation of operation.animations) {
      try { animation.cancel(); } catch (_) { /* A removed element can invalidate its animation. */ }
    }
    for (const restore of operation.restores.reverse()) restore();
    if (cancelled || error) operation.rollback?.();
    else operation.commit?.();
    if (current === operation) current = null;
    if (error) operation.reject(error);
    else operation.resolve({ cancelled });
  }

  function animate(operation, node, keyframes, options) {
    if (!node?.animate) return Promise.resolve();
    try {
      const animation = node.animate(keyframes, { fill: 'both', ...options });
      operation.animations.push(animation);
      // Rejection is a browser animation cancellation, not failed account preparation.
      return Promise.resolve(animation.finished).catch(() => {});
    } catch (_) {
      return Promise.resolve();
    }
  }

  function play(operation, jobs, duration) {
    operation.visual = true;
    operation.onVisibility = () => { if (doc?.hidden) finish(operation); };
    doc?.addEventListener?.('visibilitychange', operation.onVisibility);
    // A browser/WebView may never settle Animation.finished after a lifecycle change.
    operation.timer = schedule(() => finish(operation), duration + 180);
    if (doc?.hidden) return finish(operation);
    Promise.all(jobs).then(() => finish(operation));
  }

  function prefersReducedMotion() {
    try { return !!win.matchMedia?.('(prefers-reduced-motion: reduce)').matches; }
    catch (_) { return false; }
  }

  function revealLogin({ screen, overlay, shell, onReveal } = {}) {
    if (current) return current.promise;
    const operation = begin();
    lock(operation, screen);
    lock(operation, shell);
    const reveal = () => {
      screen?.classList.remove('login-boot-pending');
      if (overlay) overlay.hidden = true;
      if (shell) shell.inert = false;
    };
    // Boot has already prepared the form. Cancellation still leaves a usable login.
    operation.commit = reveal;
    operation.rollback = reveal;
    try {
      screen?.classList.remove('login-boot-pending');
      onReveal?.();
      if (operation.settled) return operation.promise;
      if (!overlay?.animate || doc?.hidden) {
        finish(operation);
        return operation.promise;
      }
      const reduced = prefersReducedMotion();
      const duration = reduced ? 160 : 720;
      const content = overlay.querySelector?.('.login-boot-content');
      const access = shell?.querySelector?.('.login-access');
      const jobs = [animate(operation, overlay,
        reduced ? [{ opacity: 1 }, { opacity: 0 }] :
          [{ opacity: 1, offset: 0 }, { opacity: 1, offset: .16 }, { opacity: 0, offset: 1 }],
        { duration, easing: 'cubic-bezier(.33,0,.2,1)' })];
      if (content) jobs.push(animate(operation, content, [{ opacity: 1 }, { opacity: 0 }],
        { duration: reduced ? 120 : 220, delay: reduced ? 0 : 90, easing: 'ease-out' }));
      if (access) jobs.push(animate(operation, access,
        reduced ? [{ opacity: 0 }, { opacity: 1 }] :
          [{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'translateY(0)' }],
        { duration: reduced ? 160 : 430, delay: reduced ? 0 : 270, easing: 'cubic-bezier(.2,.7,.2,1)' }));
      play(operation, jobs, duration);
    } catch (error) { finish(operation, false, error); }
    return operation.promise;
  }

  function enterGame({ from, to, prepare } = {}) {
    if (current) return current.promise;
    const operation = begin();
    const previousDisplay = to?.style.display;
    lock(operation, from);
    lock(operation, to);
    addClass(operation, from, 'scene-transition-outgoing');
    operation.commit = () => { if (from) from.style.display = 'none'; };
    operation.rollback = () => { if (to) to.style.display = previousDisplay; };
    void (async () => {
      try {
        operation.timer = schedule(() => finish(operation, false, new Error('entry preparation timed out')), 12000);
        await prepare?.();
        if (operation.settled) return;
        unschedule(operation.timer);
        operation.timer = null;
        if (!from?.animate || doc?.hidden) return finish(operation);
        const reduced = prefersReducedMotion();
        const duration = reduced ? 160 : 700;
        const jobs = [animate(operation, from,
          reduced ? [{ opacity: 1 }, { opacity: 0 }] :
            [{ opacity: 1, transform: 'scale(1)' }, { opacity: 0, transform: 'scale(1.02)' }],
          { duration, easing: 'cubic-bezier(.33,0,.2,1)' })];
        // Animate children, never the dashboard or a fixed navigation ancestor:
        // a transform on either would change the containing block of the bottom bar.
        const details = to?.querySelectorAll?.('.bottom-nav > *, .mobile-inventory-columns > *') || [];
        for (const detail of details) jobs.push(animate(operation, detail,
          reduced ? [{ opacity: 0 }, { opacity: 1 }] :
            [{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'translateY(0)' }],
          { duration: reduced ? 160 : 620, delay: reduced ? 0 : 80,
            easing: 'cubic-bezier(.2,.7,.2,1)' }));
        play(operation, jobs, duration);
      } catch (error) {
        if (!operation.settled) finish(operation, false, error);
      }
    })();
    return operation.promise;
  }

  return { create, revealLogin, enterGame, isActive: () => !!current,
    cancel() { if (current) finish(current, true); } };
});
