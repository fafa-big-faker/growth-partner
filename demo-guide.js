(function (root) {
  'use strict';
  function createController({ guide, schedule = (callback, delay = 0) => setTimeout(callback, delay), cancelSchedule = clearTimeout } = {}) {
    let generation = 0, timer = null, owned = false;
    function cancel() {
      generation++;
      if (timer !== null) cancelSchedule(timer);
      timer = null;
      if (owned) guide.destroy();
      owned = false;
    }
    function start(options) {
      cancel();
      const token = generation;
      const current = () => generation === token && options.isCurrent();
      const later = callback => {
        timer = schedule(() => { timer = null; if (current()) callback(); });
      };
      function step(index) {
        if (!current()) return;
        const steps = [
          { getTarget: options.getArmoryButton, title: '试试这把SSS仙斧吧！', description: '先打开武器库，看看为你准备的仙斧。', action: options.openArmory },
          { getTarget: options.getGiftButton, title: '就是这把，SSS斧技！', description: '点击「光头强淘汰斧」，查看它的技能。', action: options.openGift },
          { getTarget: options.getEquipButton, title: '换上它，看看惊喜', description: '点击装备，再砍几下试试斧技的威力。', action: options.equipGift },
        ];
        if (index >= steps.length) { owned = false; options.onComplete?.(); return; }
        // The armory can already be open when the ten-chop dialog closes.
        if (index === 0 && options.isArmoryOpen()) { step(1); return; }
        const entry = steps[index], target = entry.getTarget();
        if (!target?.isConnected || target.disabled) { cancel(); return; }
        target.scrollIntoView?.({ block: 'nearest', inline: 'nearest', behavior: 'instant' });
        owned = guide.start({
          title: entry.title, description: entry.description, shape: 'rounded',
          getTarget: entry.getTarget, isCurrent: current,
          onChop: async () => {
            if (!current()) return false;
            const success = await entry.action(target);
            return current() && success !== false;
          },
          onComplete: () => { owned = false; later(() => step(index + 1)); },
        });
      }
      later(() => step(0));
      return true;
    }
    function startForge(options) {
      cancel();
      const token = generation;
      const current = () => generation === token && options.isCurrent();
      timer = schedule(() => {
        timer = null;
        if (!current()) return;
        const target = options.getForgeButton();
        if (!target?.isConnected || target.disabled) return;
        target.scrollIntoView?.({ block: 'nearest', inline: 'nearest', behavior: 'instant' });
        let opened = false;
        owned = guide.start({
          title: '去天工开物，试试手气！',
          description: '用开工石锻造仙斧，寻找更强的斧技。',
          shape: 'rounded', getTarget: options.getForgeButton, isCurrent: current,
          onChop: async () => {
            if (!current()) return false;
            opened = await options.openForge(target) === true;
            return current() && opened;
          },
          onComplete: () => {
            if (!current() || !opened) return;
            owned = false;
            options.onComplete?.();
          },
        });
      }, 300);
      return true;
    }
    return { start, startForge, cancel };
  }
  // Separate from the spotlight: this hint never owns input or moves focus.
  function createBreakthroughHint({ documentRef = root.document, windowRef = root } = {}) {
    let hint = null, settings = null, resizeObserver = null, mutationObserver = null;
    const doc = documentRef, win = windowRef;
    function cancel() {
      resizeObserver?.disconnect();
      mutationObserver?.disconnect();
      resizeObserver = mutationObserver = null;
      doc.removeEventListener('pointerdown', cancel, true);
      doc.removeEventListener('click', cancel, true);
      doc.removeEventListener('keydown', onKey, true);
      doc.removeEventListener('scroll', position, true);
      win.removeEventListener('resize', position);
      win.visualViewport?.removeEventListener('resize', position);
      win.visualViewport?.removeEventListener('scroll', position);
      hint?.remove();
      hint = settings = null;
    }
    function onKey(event) { if (event.key === 'Escape') cancel(); }
    function position() {
      const target = settings?.getTarget();
      if (!hint || !settings?.isCurrent() || !target?.isConnected || target.disabled
          || doc.querySelector('.modal-overlay, .first-chop-guide')) {
        cancel();
        return false;
      }
      const rect = target.getBoundingClientRect();
      const viewport = win.visualViewport;
      const leftEdge = viewport?.offsetLeft || 0, topEdge = viewport?.offsetTop || 0;
      const width = viewport?.width || win.innerWidth, height = viewport?.height || win.innerHeight;
      const style = win.getComputedStyle(target);
      if (!rect.width || !rect.height || style.visibility === 'hidden'
          || rect.bottom <= topEdge || rect.top >= topEdge + height
          || rect.right <= leftEdge || rect.left >= leftEdge + width) {
        cancel();
        return false;
      }
      hint.style.maxWidth = `${Math.min(224, width - 24)}px`;
      const box = hint.getBoundingClientRect(), center = rect.left + rect.width / 2;
      const left = Math.max(leftEdge + 12, Math.min(center - box.width / 2, leftEdge + width - box.width - 12));
      const top = rect.top - box.height - 6;
      if (top < topEdge + 8) { cancel(); return false; }
      hint.style.left = `${left}px`;
      hint.style.top = `${top}px`;
      hint.style.setProperty('--hint-arrow-x', `${Math.max(12, Math.min(center - left, box.width - 12))}px`);
      return true;
    }
    function show(options) {
      cancel();
      settings = options;
      hint = doc.createElement('div');
      hint.className = 'demo-breakthrough-hint';
      hint.setAttribute('role', 'status');
      hint.setAttribute('aria-live', 'polite');
      hint.innerHTML = '<div class="demo-breakthrough-hint-copy">突破至中卡拉米，解锁十连砍</div>'
        + '<svg class="demo-breakthrough-hint-arrow" aria-hidden="true" viewBox="0 0 20 24">'
        + '<path d="M10 3v16M4 13l6 6 6-6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
      doc.body.append(hint);
      if (!position()) return false;
      // show() is called by checkbox change, after the triggering click's capture phase.
      // Do not preventDefault/stopPropagation: the dismissing click must still do its job.
      doc.addEventListener('pointerdown', cancel, true);
      doc.addEventListener('click', cancel, true);
      doc.addEventListener('keydown', onKey, true);
      doc.addEventListener('scroll', position, true);
      win.addEventListener('resize', position);
      win.visualViewport?.addEventListener('resize', position);
      win.visualViewport?.addEventListener('scroll', position);
      if (win.ResizeObserver) {
        resizeObserver = new win.ResizeObserver(position);
        resizeObserver.observe(options.getTarget());
      }
      if (win.MutationObserver) {
        mutationObserver = new win.MutationObserver(position);
        mutationObserver.observe(doc.body, { childList: true, subtree: true });
      }
      return true;
    }
    return { show, cancel, isActive: () => Boolean(hint) };
  }
  root.DemoWeaponGuide = { createController, createBreakthroughHint };
  if (typeof module !== 'undefined' && module.exports) module.exports = { createController, createBreakthroughHint };
})(typeof globalThis !== 'undefined' ? globalThis : window);
