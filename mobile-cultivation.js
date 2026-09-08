(function (root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.MobileCultivation = api.createController(root);
})(typeof window === 'undefined' ? globalThis : window, function () {
  'use strict';

  function createController(env) {
    const doc = env.document;
    let state = null;

    function listen(target, type, handler, options) {
      target.addEventListener(type, handler, options);
      state.cleanups.push(() => target.removeEventListener(type, handler, options));
    }

    function move(node, host) {
      const marker = doc.createComment('mobile-cultivation-home');
      node.before(marker);
      state.homes.push({ node, marker });
      host.appendChild(node);
    }

    function restoreHomes() {
      for (const { node, marker } of state.homes.reverse()) {
        if (marker.parentNode) marker.replaceWith(node);
      }
      state.homes = [];
      if (state.stage) {
        state.stage.replaceWith(...state.stage.childNodes);
        state.stage = null;
      }
    }

    function hasNestedModal() {
      return !!doc.querySelector('.modal-overlay');
    }

    function focusables() {
      return Array.from(state.panel.querySelectorAll('button, [href], input, [tabindex="0"]'))
        .filter(node => !node.disabled && !node.hidden && node.getClientRects().length);
    }

    function open() {
      if (!state?.mobile || state.open || hasNestedModal()) return false;
      state.returnFocus = doc.activeElement;
      state.oldOverflow = doc.body.style.overflow;
      state.oldInert = state.dashboard.inert;
      state.open = true;
      state.overlay.hidden = false;
      state.overlay.inert = false;
      state.trigger.setAttribute('aria-expanded', 'true');
      doc.body.style.overflow = 'hidden';
      state.dashboard.inert = true;
      state.closeButton.focus({ preventScroll: true });
      return true;
    }

    function close(options = {}) {
      if (!state?.open) return false;
      state.open = false;
      state.overlay.hidden = true;
      state.overlay.inert = false;
      state.trigger.setAttribute('aria-expanded', 'false');
      doc.body.style.overflow = state.oldOverflow;
      state.dashboard.inert = state.oldInert;
      if (options.restoreFocus !== false && !hasNestedModal()) {
        const target = state.returnFocus?.isConnected ? state.returnFocus : state.trigger;
        target.focus({ preventScroll: true });
      }
      return true;
    }

    function beforeInventoryRender(tab) {
      if (!state) return;
      state.scroll[state.tab] = state.grid.scrollTop;
      state.tab = tab;
    }

    function refreshInventory(tab) {
      if (!state) return;
      state.tab = tab || state.tab;
      state.grid.scrollTop = state.scroll[state.tab] || 0;
      const slots = Array.from(state.grid.querySelectorAll('.item-slot:not(.empty)'));
      state.grid.setAttribute('aria-label', state.tab === 'weapons' ? '武器' : '道具');
      for (const slot of slots) {
        slot.setAttribute('role', 'button');
        slot.setAttribute('tabindex', '0');
        slot.setAttribute('aria-label', slot.querySelector('img')?.alt || '查看物品');
      }
      state.count.textContent = `${state.tab === 'weapons' ? '武器' : '道具'} ${slots.length}`;
      state.novelty.hidden = !state.grid.querySelector('.item-new-badge');
      state.preview.replaceChildren();
      for (const slot of slots.slice(0, 3)) {
        const source = slot.querySelector('img');
        if (!source) continue;
        const image = source.cloneNode(false);
        image.removeAttribute('id');
        image.className = '';
        image.alt = '';
        state.preview.appendChild(image);
      }
      state.equippedName.textContent = state.equipment.querySelector('.equip-name')?.textContent || '';
      for (const tabButton of state.inventory.querySelectorAll('.inv-tab-v')) {
        tabButton.setAttribute('aria-selected', String(tabButton.dataset.tab === state.tab));
      }
    }

    function switchMode() {
      if (!state) return;
      const mobile = state.media.matches;
      if (mobile === state.mobile) return;
      close({ restoreFocus: false });
      state.mobile = mobile;
      state.dashboard.classList.toggle('mobile-cultivation', mobile);
      state.trigger.hidden = !mobile;
      if (mobile) {
        if (state.scene) {
          state.stage = doc.createElement('div');
          state.stage.className = 'mobile-scene-stage';
          while (state.scene.firstChild) state.stage.appendChild(state.scene.firstChild);
          state.scene.appendChild(state.stage);
        }
        move(state.inventory, state.drawerBody);
        move(state.equipment, state.drawerBody);
        move(state.forge, state.actions);
      } else {
        restoreHomes();
      }
      refreshInventory();
    }

    function mount(snapshot = {}) {
      unmount();
      const main = doc.getElementById('player-main');
      const dashboard = doc.getElementById('player-dashboard');
      const inventory = main?.querySelector('.cult-inventory');
      const equipment = main?.querySelector('.equip-info-bar');
      const forge = equipment?.querySelector('.forge-btn');
      const grid = inventory?.querySelector('#inventory-grid');
      const actions = main?.querySelector('.cult-action');
      if (!dashboard || !inventory || !equipment || !forge || !grid || !actions) return;

      const trigger = doc.createElement('button');
      trigger.type = 'button';
      trigger.className = 'mobile-inventory-trigger';
      trigger.hidden = true;
      trigger.setAttribute('aria-haspopup', 'dialog');
      trigger.setAttribute('aria-controls', 'mobile-inventory-dialog');
      trigger.setAttribute('aria-expanded', 'false');
      trigger.innerHTML = '<span class="mobile-inventory-label">背包<span class="mobile-inventory-count"></span></span><span class="mobile-inventory-preview" aria-hidden="true"></span><span class="mobile-inventory-new" hidden>新</span><span class="mobile-inventory-chevron" aria-hidden="true">⌃</span><span class="mobile-equipped-name"></span>';
      inventory.before(trigger);

      // This is deliberately not a .modal-overlay: item actions may remove those
      // overlays, but must never delete the sole inventory DOM underneath them.
      const overlay = doc.createElement('div');
      overlay.className = 'mobile-inventory-overlay';
      overlay.hidden = true;
      overlay.innerHTML = '<section class="modal mobile-inventory-panel" id="mobile-inventory-dialog" role="dialog" aria-modal="true" aria-labelledby="mobile-inventory-title" tabindex="-1"><header class="mobile-inventory-header"><h2 id="mobile-inventory-title">背包</h2><button type="button" class="mobile-inventory-close" aria-label="收起背包" title="收起背包">×</button></header><div class="mobile-inventory-body"></div></section>';
      doc.body.appendChild(overlay);
      state = {
        main, dashboard, inventory, equipment, forge, grid, actions, trigger, overlay,
        scene: main.querySelector('.cult-scene'), stage: null,
        panel: overlay.querySelector('.mobile-inventory-panel'),
        drawerBody: overlay.querySelector('.mobile-inventory-body'),
        closeButton: overlay.querySelector('.mobile-inventory-close'),
        count: trigger.querySelector('.mobile-inventory-count'),
        novelty: trigger.querySelector('.mobile-inventory-new'),
        preview: trigger.querySelector('.mobile-inventory-preview'),
        equippedName: trigger.querySelector('.mobile-equipped-name'),
        media: env.matchMedia('(max-width: 719px), (max-height: 500px) and (max-width: 950px)'),
        scroll: { items: 0, weapons: 0, ...(snapshot.scroll || {}) },
        tab: grid.classList.contains('weapons-grid') ? 'weapons' : 'items',
        mobile: false, open: false, homes: [], cleanups: [],
      };
      state.inventory.querySelector('.inv-tabs-v').setAttribute('role', 'tablist');
      for (const tabButton of state.inventory.querySelectorAll('.inv-tab-v')) {
        tabButton.setAttribute('role', 'tab');
        tabButton.setAttribute('aria-controls', 'inventory-grid');
      }
      grid.setAttribute('role', 'tabpanel');
      listen(trigger, 'click', open);
      listen(state.closeButton, 'click', () => close());
      listen(overlay, 'click', event => { if (event.target === overlay && !hasNestedModal()) close(); });
      listen(grid, 'scroll', () => { state.scroll[state.tab] = grid.scrollTop; }, { passive: true });
      listen(inventory, 'keydown', event => {
        const slot = event.target.closest('.item-slot:not(.empty)');
        if (slot && (event.key === 'Enter' || event.key === ' ')) {
          event.preventDefault();
          slot.click();
          return;
        }
        const tabButton = event.target.closest('.inv-tab-v');
        if (!tabButton || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault();
        const tabs = Array.from(inventory.querySelectorAll('.inv-tab-v'));
        const index = tabs.indexOf(tabButton);
        const next = event.key === 'Home' ? tabs[0] : event.key === 'End' ? tabs.at(-1) : tabs[(index + (event.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
        next.focus({ preventScroll: true });
        next.click();
      });
      listen(doc, 'keydown', event => {
        if (!state?.open) return;
        if (hasNestedModal()) {
          const topModal = Array.from(doc.querySelectorAll('.modal-overlay')).at(-1);
          if (event.key === 'Escape') {
            if (!topModal.classList.contains('modal-locked')) {
              event.preventDefault();
              topModal.remove();
              state.closeButton.focus({ preventScroll: true });
            }
          } else if (event.key === 'Tab') {
            const targets = Array.from(topModal.querySelectorAll('button, [href], input, select, textarea, [tabindex="0"]'))
              .filter(node => !node.disabled && !node.hidden && node.getClientRects().length);
            const first = targets[0];
            const last = targets.at(-1);
            if (first && (event.shiftKey ? doc.activeElement === first || !topModal.contains(doc.activeElement) : doc.activeElement === last || !topModal.contains(doc.activeElement))) {
              event.preventDefault();
              (event.shiftKey ? last : first).focus();
            }
          }
          return;
        }
        if (event.key === 'Escape') {
          event.preventDefault();
          close();
        } else if (event.key === 'Tab') {
          const targets = focusables();
          const first = targets[0] || state.panel;
          const last = targets.at(-1) || state.panel;
          if (event.shiftKey && (doc.activeElement === first || !state.panel.contains(doc.activeElement))) {
            event.preventDefault(); last.focus();
          } else if (!event.shiftKey && (doc.activeElement === last || !state.panel.contains(doc.activeElement))) {
            event.preventDefault(); first.focus();
          }
        }
      });
      const onMediaChange = () => switchMode();
      if (state.media.addEventListener) listen(state.media, 'change', onMediaChange);
      else {
        state.media.addListener(onMediaChange);
        state.cleanups.push(() => state.media.removeListener(onMediaChange));
      }
      if (env.MutationObserver) {
        const observer = new env.MutationObserver(() => {
          if (!state) return;
          if (state.dashboard.style.display === 'none') unmount();
          else if (state.open) {
            const nested = Array.from(doc.querySelectorAll('.modal-overlay')).at(-1);
            state.overlay.inert = !!nested;
            if (nested && !nested.contains(doc.activeElement)) {
              nested.querySelector('button:not(:disabled), input:not(:disabled), select:not(:disabled)')?.focus({ preventScroll: true });
            } else if (!nested && !state.panel.contains(doc.activeElement)) {
              state.closeButton.focus({ preventScroll: true });
            }
          }
        });
        observer.observe(dashboard, { attributes: true, attributeFilter: ['style'] });
        const modalContainer = doc.getElementById('modal-container');
        if (modalContainer) observer.observe(modalContainer, { childList: true });
        state.cleanups.push(() => observer.disconnect());
      }
      switchMode();
      refreshInventory();
      if (snapshot.open && state.mobile) open();
    }

    function unmount(options = {}) {
      if (!state) return {};
      const snapshot = { open: state.open, scroll: { ...state.scroll, [state.tab]: state.grid.scrollTop } };
      close({ restoreFocus: false });
      for (const cleanup of state.cleanups) cleanup();
      restoreHomes();
      state.dashboard.classList.remove('mobile-cultivation');
      state.trigger.remove();
      state.overlay.remove();
      state = null;
      return options.preserve ? snapshot : {};
    }

    return { mount, unmount, open, close, beforeInventoryRender, refreshInventory };
  }

  return { createController };
});
