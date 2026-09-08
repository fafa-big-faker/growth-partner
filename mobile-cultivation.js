(function (root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.MobileCultivation = api.createController(root);
})(typeof window === 'undefined' ? globalThis : window, function () {
  'use strict';

  const MEDIA_QUERY = '(max-width: 719px), (max-height: 500px) and (max-width: 950px)';

  function createController(env) {
    const doc = env.document;
    let state = null;
    let navigation = null;
    let saved = {};

    function listen(owner, target, type, handler, options) {
      target.addEventListener(type, handler, options);
      owner.cleanups.push(() => target.removeEventListener(type, handler, options));
    }

    function isMobile() {
      return navigation ? navigation.media.matches : !!env.matchMedia?.(MEDIA_QUERY).matches;
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

    function applyNavigation() {
      if (!navigation) return;
      const mobile = isMobile();
      const cultivation = navigation.page === 'cultivate';
      navigation.dashboard.classList.toggle('mobile-player-navigation', mobile);
      navigation.dashboard.dataset.mobilePage = navigation.page;
      navigation.center.hidden = mobile && cultivation;
      navigation.center.classList.toggle('mobile-return-button', mobile && !cultivation);
      navigation.center.setAttribute('aria-label', mobile && !cultivation ? '返回修仙' : '修仙');
      navigation.centerText.textContent = mobile && !cultivation ? '返回' : navigation.originalText;
      if (navigation.centerImage) {
        const src = mobile && !cultivation ? 'assets/runtime/ui/undo-2.svg' : navigation.originalSource;
        if (navigation.centerImage.getAttribute('src') !== src) navigation.centerImage.setAttribute('src', src);
      }
    }

    function ensureNavigation() {
      if (navigation) return true;
      const dashboard = doc.getElementById('player-dashboard');
      const nav = dashboard?.querySelector('.bottom-nav');
      const center = nav?.querySelector('[data-tab="cultivate"]');
      const centerText = center?.querySelector('.nav-text');
      if (!nav || !centerText || !env.matchMedia) return false;
      const centerImage = center.querySelector('img');
      navigation = {
        dashboard, nav, center, centerText, centerImage,
        originalText: centerText.textContent,
        originalSource: centerImage?.getAttribute('src'),
        page: dashboard.dataset.playerScene || 'cultivate',
        media: env.matchMedia(MEDIA_QUERY), cleanups: [],
      };
      for (const item of nav.querySelectorAll('.nav-item')) {
        const role = item.getAttribute('role');
        const tabIndex = item.getAttribute('tabindex');
        item.setAttribute('role', 'button');
        item.setAttribute('tabindex', '0');
        navigation.cleanups.push(() => {
          role === null ? item.removeAttribute('role') : item.setAttribute('role', role);
          tabIndex === null ? item.removeAttribute('tabindex') : item.setAttribute('tabindex', tabIndex);
        });
      }
      listen(navigation, nav, 'keydown', event => {
        const item = event.target.closest('.nav-item');
        if (item && (event.key === 'Enter' || event.key === ' ')) {
          event.preventDefault();
          item.click();
        }
      });
      const onMediaChange = () => {
        switchMode();
        applyNavigation();
      };
      if (navigation.media.addEventListener) listen(navigation, navigation.media, 'change', onMediaChange);
      else {
        const media = navigation.media;
        media.addListener(onMediaChange);
        navigation.cleanups.push(() => media.removeListener(onMediaChange));
      }
      if (env.MutationObserver) {
        const observer = new env.MutationObserver(() => {
          if (navigation?.dashboard.style.display === 'none') unmount();
        });
        observer.observe(dashboard, { attributes: true, attributeFilter: ['style'] });
        navigation.cleanups.push(() => observer.disconnect());
      }
      applyNavigation();
      return true;
    }

    function setPage(tab) {
      if (!ensureNavigation()) return;
      if (tab !== 'cultivate' && state) unmount({ preserve: true });
      navigation.page = tab;
      applyNavigation();
    }

    function captureScroll() {
      if (!state || state.transitioning || (state.mobile !== null && isMobile() !== state.mobile)) return;
      state.scroll[state.tab] = state.grid.scrollTop;
      if (state.mobile) {
        const host = state.mode === 'library' ? state.weaponGrid : state.equipmentContent;
        state.rightScroll[state.mode] = host.scrollTop;
      }
    }

    function showMode(mode) {
      if (!state?.mobile) return false;
      captureScroll();
      state.mode = mode;
      const library = mode === 'library';
      state.equipmentContent.hidden = library;
      state.weaponGrid.hidden = !library;
      state.modeButton.textContent = library ? '返回' : '武器库';
      state.modeButton.setAttribute('aria-label', library ? '返回当前装备' : '打开武器库');
      state.modeButton.setAttribute('aria-expanded', String(library));
      const host = library ? state.weaponGrid : state.equipmentContent;
      host.scrollTop = state.rightScroll[mode] || 0;
      return true;
    }

    function open() { return showMode('library'); }
    function close() { return showMode('equipment'); }

    function beforeInventoryRender(tab) {
      if (!state) return;
      captureScroll();
      state.tab = tab;
    }

    function refreshInventory(tab) {
      if (!state) return;
      state.tab = tab || state.tab;
      state.grid.scrollTop = state.scroll[state.tab] || 0;
      state.grid.setAttribute('aria-label', state.tab === 'weapons' ? '武器' : '道具');
      for (const slot of state.grid.querySelectorAll('.item-slot:not(.empty)')) {
        slot.setAttribute('role', 'button');
        slot.setAttribute('tabindex', '0');
        slot.setAttribute('aria-label', slot.querySelector('img')?.alt || '查看物品');
      }
      for (const tabButton of state.inventory.querySelectorAll('.inv-tab-v')) {
        tabButton.setAttribute('aria-selected', String(tabButton.dataset.tab === state.tab));
      }
    }

    function refreshEquipment(presentation = {}) {
      if (!state) return;
      captureScroll();
      if (typeof presentation.html === 'string' && presentation.html !== state.equipmentHtml) {
        state.equipmentContent.innerHTML = presentation.html;
        state.equipmentHtml = presentation.html;
      }
      if (typeof presentation.weaponsHtml === 'string' && presentation.weaponsHtml !== state.weaponsHtml) {
        state.weaponGrid.innerHTML = presentation.weaponsHtml;
        state.weaponsHtml = presentation.weaponsHtml;
      }
      state.equipmentContent.scrollTop = state.rightScroll.equipment || 0;
      state.weaponGrid.scrollTop = state.rightScroll.library || 0;
    }

    function switchMode() {
      if (!state || isMobile() === state.mobile) return;
      if (state.mobile !== null) captureScroll();
      const scroll = { ...state.scroll };
      const rightScroll = { ...state.rightScroll };
      // Moving a scroller to a larger or hidden host can clamp scrollTop to zero.
      // Preserve the user's offsets until the destination layout is populated.
      state.transitioning = true;
      state.mobile = isMobile();
      state.dashboard.classList.toggle('mobile-cultivation', state.mobile);
      state.dual.hidden = !state.mobile;
      if (state.mobile) {
        if (state.scene) {
          state.stage = doc.createElement('div');
          state.stage.className = 'mobile-scene-stage';
          while (state.scene.firstChild) state.stage.appendChild(state.scene.firstChild);
          state.scene.appendChild(state.stage);
        }
        move(state.grid, state.itemsPane);
        move(state.chop, navigation.nav);
        move(state.ten, navigation.nav);
        move(state.forge, navigation.nav);
        showMode(state.mode);
      } else {
        restoreHomes();
      }
      applyNavigation();
      // PlayerView is lexical in the app; responsive redraw uses the supplied callback.
      state.onModeChange?.();
      state.scroll = scroll;
      state.rightScroll = rightScroll;
      refreshInventory();
      state.equipmentContent.scrollTop = rightScroll.equipment || 0;
      state.weaponGrid.scrollTop = rightScroll.library || 0;
      state.transitioning = false;
    }

    function mount(snapshot = {}, options = {}) {
      if (state) unmount({ preserve: true });
      if (!ensureNavigation()) return;
      const main = doc.getElementById('player-main');
      const inventory = main?.querySelector('.cult-inventory');
      const equipment = main?.querySelector('.equip-info-bar');
      const grid = inventory?.querySelector('#inventory-grid');
      const forge = equipment?.querySelector('.forge-btn');
      const chop = main?.querySelector('#chop-btn');
      const ten = main?.querySelector('.ten-toggle');
      if (!inventory || !equipment || !grid || !forge || !chop || !ten) return;
      const restore = { ...saved, ...snapshot };
      const dual = doc.createElement('section');
      dual.className = 'mobile-inventory-columns';
      dual.hidden = true;
      dual.setAttribute('aria-label', '背包与装备');
      dual.innerHTML = '<div class="mobile-items-pane"></div><section class="mobile-equipment-pane" aria-label="仙斧"><div id="mobile-equipment-content" class="mobile-equipment-content" tabindex="0" aria-label="当前装备"></div><div id="mobile-weapon-grid" class="mobile-weapon-grid inventory-grid weapons-grid" aria-label="武器库" hidden></div><button type="button" id="mobile-weapon-toggle" class="mobile-weapon-toggle" aria-controls="mobile-weapon-grid" aria-expanded="false">武器库</button></section>';
      inventory.before(dual);
      state = {
        main, dashboard: navigation.dashboard, inventory, equipment, grid, forge, chop, ten, dual,
        scene: main.querySelector('.cult-scene'), stage: null,
        itemsPane: dual.querySelector('.mobile-items-pane'),
        equipmentContent: dual.querySelector('#mobile-equipment-content'),
        weaponGrid: dual.querySelector('#mobile-weapon-grid'),
        modeButton: dual.querySelector('.mobile-weapon-toggle'),
        scroll: { items: 0, weapons: 0, ...(restore.scroll || {}) },
        rightScroll: { equipment: 0, library: 0, ...(restore.rightScroll || {}) },
        mode: restore.mode === 'library' ? 'library' : 'equipment',
        tab: grid.classList.contains('weapons-grid') ? 'weapons' : 'items',
        mobile: null, homes: [], cleanups: [], onModeChange: options.onModeChange,
      };
      navigation.page = 'cultivate';
      inventory.querySelector('.inv-tabs-v')?.setAttribute('role', 'tablist');
      for (const button of inventory.querySelectorAll('.inv-tab-v')) {
        button.setAttribute('role', 'tab');
        button.setAttribute('aria-controls', 'inventory-grid');
      }
      grid.setAttribute('role', 'tabpanel');
      listen(state, state.modeButton, 'click', () => showMode(state.mode === 'library' ? 'equipment' : 'library'));
      const canCapture = () => state && !state.transitioning && isMobile() === state.mobile;
      listen(state, grid, 'scroll', () => {
        if (canCapture()) state.scroll[state.tab] = grid.scrollTop;
      }, { passive: true });
      listen(state, state.equipmentContent, 'scroll', () => {
        if (canCapture() && state.mobile && state.mode === 'equipment') state.rightScroll.equipment = state.equipmentContent.scrollTop;
      }, { passive: true });
      listen(state, state.weaponGrid, 'scroll', () => {
        if (canCapture() && state.mobile && state.mode === 'library') state.rightScroll.library = state.weaponGrid.scrollTop;
      }, { passive: true });
      listen(state, main, 'keydown', event => {
        const slot = event.target.closest('.item-slot:not(.empty)');
        if (slot && slot.tagName !== 'BUTTON' && (event.key === 'Enter' || event.key === ' ')) {
          event.preventDefault();
          slot.click();
        }
        const tab = event.target.closest('.inv-tab-v');
        if (!tab || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault();
        const tabs = Array.from(inventory.querySelectorAll('.inv-tab-v'));
        const index = tabs.indexOf(tab);
        const next = event.key === 'Home' ? tabs[0] : event.key === 'End' ? tabs.at(-1) : tabs[(index + (event.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
        next.focus({ preventScroll: true });
        next.click();
      });
      listen(state, doc, 'keydown', event => {
        if (!state?.mobile) return;
        const modal = Array.from(doc.querySelectorAll('.modal-overlay')).at(-1);
        if (!modal) return;
        if (event.key === 'Escape' && !modal.classList.contains('modal-locked')) {
          event.preventDefault();
          modal.remove();
          state.modeButton.focus({ preventScroll: true });
        } else if (event.key === 'Tab') {
          const targets = Array.from(modal.querySelectorAll('button, [href], input, select, textarea, [tabindex="0"]'))
            .filter(node => !node.disabled && !node.hidden && node.getClientRects().length);
          const first = targets[0];
          const last = targets.at(-1);
          if (first && (event.shiftKey ? doc.activeElement === first || !modal.contains(doc.activeElement) : doc.activeElement === last || !modal.contains(doc.activeElement))) {
            event.preventDefault();
            (event.shiftKey ? last : first).focus();
          }
        }
      });
      const initialScroll = { ...state.scroll };
      const initialRightScroll = { ...state.rightScroll };
      switchMode();
      state.scroll = initialScroll;
      state.rightScroll = initialRightScroll;
      refreshInventory();
      state.equipmentContent.scrollTop = state.rightScroll.equipment;
      state.weaponGrid.scrollTop = state.rightScroll.library;
    }

    function unmount(options = {}) {
      if (state) {
        captureScroll();
        saved = { mode: state.mode, scroll: { ...state.scroll }, rightScroll: { ...state.rightScroll } };
        for (const cleanup of state.cleanups) cleanup();
        restoreHomes();
        state.dashboard.classList.remove('mobile-cultivation');
        state.dual.remove();
        state = null;
      }
      if (options.preserve) return { ...saved, ...(saved.scroll ? { scroll: { ...saved.scroll }, rightScroll: { ...saved.rightScroll } } : {}) };
      if (navigation) {
        for (const cleanup of navigation.cleanups) cleanup();
        navigation.dashboard.classList.remove('mobile-player-navigation');
        delete navigation.dashboard.dataset.mobilePage;
        navigation.center.hidden = false;
        navigation.center.classList.remove('mobile-return-button');
        navigation.center.removeAttribute('aria-label');
        navigation.centerText.textContent = navigation.originalText;
        if (navigation.centerImage) navigation.centerImage.setAttribute('src', navigation.originalSource);
        navigation = null;
      }
      saved = {};
      return {};
    }

    return { mount, unmount, isMobile, setPage, open, close, beforeInventoryRender, refreshInventory, refreshEquipment };
  }

  return { createController };
});
