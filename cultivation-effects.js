(function initCultivationEffects(root) {
  const ASSET_ROOT = 'assets/images/v2/effects/';

  function createCultivationEffects(options = {}) {
    const documentRef = options.document || root.document;
    const random = options.random || Math.random;
    const schedule = options.schedule || ((callback, delay) => setTimeout(callback, delay));
    const liveNodes = new Set();

    function addParticle(scene, kind, origin, index) {
      const node = documentRef.createElement('span');
      const isLeaf = kind === 'leaf';
      const direction = index % 2 === 0 ? -1 : 1;
      const spreadX = direction * (28 + random() * 54);
      const spreadY = isLeaf ? 42 + random() * 54 : -14 - random() * 26;
      const asset = isLeaf
        ? (index % 3 === 0 ? 'effect-leaf-gold.png' : 'effect-leaf-green.png')
        : (index % 2 === 0 ? 'effect-hit-spark.png' : 'effect-drop-glow.png');

      node.className = `cult-effect cult-effect-${kind}`;
      node.dataset.effect = kind;
      node.style.left = `${origin.x}px`;
      node.style.top = `${origin.y}px`;
      node.style.backgroundImage = `url('${ASSET_ROOT}${asset}')`;
      node.style.setProperty('--effect-x', `${spreadX.toFixed(1)}px`);
      node.style.setProperty('--effect-y', `${spreadY.toFixed(1)}px`);
      node.style.setProperty('--effect-rotate', `${(-80 + random() * 160).toFixed(1)}deg`);
      node.style.setProperty('--effect-scale', (0.7 + random() * 0.65).toFixed(2));
      node.style.setProperty('--effect-delay', `${(random() * 90).toFixed(0)}ms`);
      scene.appendChild(node);
      liveNodes.add(node);

      schedule(() => {
        if (node.isConnected) node.remove();
        liveNodes.delete(node);
      }, isLeaf ? 1050 : 720);
    }

    return {
      playHit({ scene, tree, intensity = 1 } = {}) {
        if (!scene || !tree || !documentRef?.createElement) return 0;
        const sceneRect = scene.getBoundingClientRect();
        const treeRect = tree.getBoundingClientRect();
        const origin = {
          x: treeRect.left - sceneRect.left + treeRect.width * 0.42,
          y: treeRect.top - sceneRect.top + treeRect.height * 0.45,
        };
        const multiplier = Math.max(1, Math.min(2, Number(intensity) || 1));
        const leafCount = Math.round(5 * multiplier);
        const sparkCount = Math.round(2 * multiplier);

        for (let index = 0; index < leafCount; index += 1) {
          addParticle(scene, 'leaf', origin, index);
        }
        for (let index = 0; index < sparkCount; index += 1) {
          addParticle(scene, 'spark', origin, index);
        }
        return leafCount + sparkCount;
      },

      clear() {
        liveNodes.forEach(node => {
          if (node.isConnected) node.remove();
        });
        liveNodes.clear();
      },
    };
  }

  const controller = createCultivationEffects();
  root.CultivationEffects = controller;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { createCultivationEffects };
  }
})(typeof globalThis !== 'undefined' ? globalThis : window);
