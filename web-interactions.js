(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else {
    root.WebInteractions = api.createController({ document: root.document });
    root.WebInteractions.init();
  }
})(typeof globalThis === 'undefined' ? window : globalThis, function () {
  'use strict';

  const GAME_SURFACE = '#login-screen, #player-dashboard, #admin-dashboard, #modal-container, #toast-container, #floating-items-container';
  const NATIVE_CONTROL = 'input, textarea, select, option, [data-native-interaction]';
  const GUARDED_EVENTS = ['contextmenu', 'dragstart', 'selectstart'];

  function createController({ document: doc } = {}) {
    let initialized = false;

    function protectSurface(event) {
      const target = event.target?.nodeType === 3 ? event.target.parentElement : event.target;
      if (!target?.closest?.(GAME_SURFACE)) return;
      if (target.closest(NATIVE_CONTROL) || target.isContentEditable) return;
      const editable = target.closest('[contenteditable]');
      if (editable && editable.getAttribute('contenteditable') !== 'false') return;
      event.preventDefault();
    }

    return {
      init() {
        if (initialized || !doc?.addEventListener) return;
        GUARDED_EVENTS.forEach(name => doc.addEventListener(name, protectSurface));
        initialized = true;
      },
      destroy() {
        if (!initialized) return;
        GUARDED_EVENTS.forEach(name => doc.removeEventListener(name, protectSurface));
        initialized = false;
      },
    };
  }

  return { createController };
});
