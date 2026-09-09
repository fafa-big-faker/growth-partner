(function (root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.XianlaiShell = api.createController();
})(typeof window === 'undefined' ? globalThis : window, function (root) {
  'use strict';

  function createController(options = {}) {
    const doc = options.document || root.document;
    let backgrounded = false;
    let destroyed = false;

    const resolve = value => typeof value === 'function' ? value() : value;
    const navigation = () => resolve(options.navigation)
      || (typeof Router === 'undefined' ? root.Router : Router);
    const getAudio = () => resolve(options.audio)
      || (typeof AudioManager === 'undefined' ? root.AudioManager : AudioManager);
    const getOperations = () => resolve(options.operations)
      || (typeof OperationGuard === 'undefined' ? root.OperationGuard : OperationGuard);
    const getGuide = () => resolve(options.guide) || root.FirstChopGuide;

    function visible(node) {
      if (!node || node.isConnected === false) return false;
      for (let current = node; current; current = current.parentElement) {
        if (current.hidden) return false;
        const style = doc?.defaultView?.getComputedStyle?.(current) || current.style;
        if (style?.display === 'none' || style?.visibility === 'hidden') return false;
      }
      return true;
    }

    function busy() {
      if (getOperations()?.isBusy?.()) return true;
      return Array.from(doc?.querySelectorAll?.('[aria-busy="true"]') || []).some(visible);
    }

    function handleBack() {
      if (destroyed) return false;
      if (getGuide()?.isActive?.()) return true;
      const modal = Array.from(doc?.querySelectorAll?.('.modal-overlay') || []).filter(visible).at(-1);
      if (modal) {
        if (modal.classList?.contains('modal-locked') || busy()) return true;
        const close = modal.querySelector?.('.modal-close');
        if (visible(close) && !close.disabled && close.getAttribute?.('aria-disabled') !== 'true') {
          // Reuse the game's close handler, including reward cancellation and locks.
          close.click();
        }
        return true;
      }
      if (busy()) return true;

      const router = navigation();
      if (visible(doc?.getElementById?.('player-dashboard'))) {
        const libraryToggle = doc.getElementById('mobile-weapon-toggle');
        if (visible(libraryToggle) && libraryToggle.getAttribute?.('aria-expanded') === 'true') {
          if (!libraryToggle.disabled) libraryToggle.click();
          return true;
        }
        if (router?.currentPlayerTab && router.currentPlayerTab !== 'cultivate' && router.playerTab) {
          router.playerTab('cultivate');
          return true;
        }
      } else if (visible(doc?.getElementById?.('admin-dashboard'))) {
        if (router?.currentAdminTab && router.currentAdminTab !== 'task-manage' && router.adminTab) {
          router.adminTab('task-manage');
          return true;
        }
      }
      return false;
    }

    function setBackgrounded(value) {
      if (destroyed) return;
      const next = Boolean(value);
      if (backgrounded === next) return;
      backgrounded = next;
      getGuide()?.setBackgrounded?.(backgrounded);
      const audio = getAudio();
      audio?.setSuspended?.(backgrounded);
      if (!backgrounded && (visible(doc?.getElementById?.('player-dashboard'))
          || visible(doc?.getElementById?.('admin-dashboard')))) {
        // playBgm honors the manager's mute flag and records playback intent so
        // unmuting later works. Never persist a temporary lifecycle mute value.
        const playing = audio?.playBgm?.();
        playing?.catch?.(() => {});
      }
    }

    function destroy() {
      if (destroyed) return;
      destroyed = true;
    }

    return { handleBack, setBackgrounded, destroy };
  }

  return { createController };
});
