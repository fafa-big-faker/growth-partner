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
  root.DemoWeaponGuide = { createController };
  if (typeof module !== 'undefined' && module.exports) module.exports = { createController };
})(typeof globalThis !== 'undefined' ? globalThis : window);
