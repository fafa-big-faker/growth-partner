(function initCultivationEffects(root) {
  const LEAF_ASSET = 'assets/runtime/effects/leaf-ink.webp?v=ink-feedback-20260908';
  const MAX_LIVE_NODES = 24;

  function createCultivationEffects(options = {}) {
    const documentRef = options.document || root.document;
    const random = options.random || Math.random;
    const schedule = options.schedule || ((callback, delay) => setTimeout(callback, delay));
    const cancelSchedule = options.cancelSchedule || clearTimeout;
    const motionQuery = root.matchMedia?.('(prefers-reduced-motion: reduce)');
    const liveNodes = new Map();
    let destroyed = false;

    function release(node, cancel = true) {
      if (!liveNodes.has(node)) return;
      if (cancel) cancelSchedule(liveNodes.get(node));
      node.remove?.();
      liveNodes.delete(node);
    }

    function clear() {
      [...liveNodes.keys()].forEach(node => release(node));
    }

    function onVisibilityChange() {
      if (documentRef.hidden) clear();
    }
    documentRef?.addEventListener?.('visibilitychange', onVisibilityChange);

    function addParticle(scene, kind, origin, index, timing, scale, reduced) {
      while (liveNodes.size >= MAX_LIVE_NODES) release(liveNodes.keys().next().value);
      const node = documentRef.createElement('span');
      const isLeaf = kind === 'leaf';
      const direction = index % 2 === 0 ? -1 : 1;
      const duration = reduced ? 120 : Math.round((isLeaf ? 720 : 180) / Math.sqrt(timing.speed));
      const delay = reduced ? 0 : Math.round(timing.impactDelay + (isLeaf ? random() * 60 / timing.speed : 0));

      node.className = `cult-effect cult-effect-${kind}${reduced ? ' cult-effect-reduced' : ''}`;
      node.dataset.effect = kind;
      node.setAttribute?.('aria-hidden', 'true');
      node.style.left = `${(origin.x + (isLeaf ? (random() - 0.5) * 34 * scale : 0)).toFixed(1)}px`;
      node.style.top = `${(origin.y + (isLeaf ? (random() - 0.5) * 10 * scale : 0)).toFixed(1)}px`;
      if (isLeaf) node.style.backgroundImage = `url('${LEAF_ASSET}')`;
      node.style.setProperty('--effect-x', `${(direction * (18 + random() * 30) * scale).toFixed(1)}px`);
      node.style.setProperty('--effect-y', `${((48 + random() * 32) * scale).toFixed(1)}px`);
      node.style.setProperty('--effect-lift', `${(-10 * scale).toFixed(1)}px`);
      node.style.setProperty('--effect-rotate', `${(direction * (70 + random() * 95)).toFixed(1)}deg`);
      node.style.setProperty('--effect-scale', (scale * (0.8 + random() * 0.25)).toFixed(2));
      node.style.setProperty('--effect-duration', `${duration}ms`);
      node.style.setProperty('--effect-delay', `${delay}ms`);
      scene.appendChild(node);
      liveNodes.set(node, schedule(() => release(node, false), delay + duration + 40));
    }

    return {
      playHit({ scene, tree, intensity = 1, speed = 1 } = {}) {
        if (destroyed || documentRef?.hidden || !scene || !tree || !documentRef?.createElement) return 0;
        const sceneRect = scene.getBoundingClientRect();
        const treeRect = tree.getBoundingClientRect();
        if (!sceneRect.width || !sceneRect.height || !treeRect.width || !treeRect.height) return 0;
        const imageRect = tree.querySelector?.('.tree-img')?.getBoundingClientRect() || treeRect;
        const scaleX = sceneRect.width / (scene.offsetWidth || scene.clientWidth || sceneRect.width);
        const scaleY = sceneRect.height / (scene.offsetHeight || scene.clientHeight || sceneRect.height);
        const localPoint = (rect, x, y) => ({
          x: (rect.left - sceneRect.left + rect.width * x) / scaleX - (scene.clientLeft || 0),
          y: (rect.top - sceneRect.top + rect.height * y) / scaleY - (scene.clientTop || 0),
        });
        // Match the existing strike point; leaves start on the crown, not at the axe.
        const strike = localPoint(treeRect, 0.42, 0.45);
        const crown = localPoint(imageRect, 0.52, 0.28);
        const safeSpeed = Math.max(1, Math.min(3, Number(speed) || 1));
        const timing = { speed: safeSpeed, impactDelay: 180 / safeSpeed };
        const scale = Math.max(0.65, Math.min(1.15, imageRect.width / scaleX / 176));
        const reduced = typeof options.reducedMotion === 'function'
          ? options.reducedMotion()
          : (options.reducedMotion ?? motionQuery?.matches ?? false);
        addParticle(scene, 'cut', strike, 0, timing, scale, reduced);
        if (reduced) return 1;

        const leafCount = Math.max(3, Math.min(5, Math.round(3 + (Number(intensity) || 1))));
        for (let index = 0; index < leafCount; index += 1) {
          addParticle(scene, 'leaf', crown, index, timing, scale, false);
        }
        return leafCount + 1;
      },

      clear,

      destroy() {
        clear();
        documentRef?.removeEventListener?.('visibilitychange', onVisibilityChange);
        destroyed = true;
      },
    };
  }

  const controller = createCultivationEffects();
  root.CultivationEffects = controller;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { createCultivationEffects };
  }
})(typeof globalThis !== 'undefined' ? globalThis : window);
