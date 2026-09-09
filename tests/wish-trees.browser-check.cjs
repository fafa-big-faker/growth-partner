/* Real local art and mocked player state. No screenshots or account/database requests. */
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');

const SKINS = ['tree_01', 'tree_02', 'tree_03', 'tree_04', 'tree_05'];
const DEVICE_DPR = Number(process.argv.find(argument => argument.startsWith('--dpr='))?.split('=')[1] || 1);
assert.ok([1, 2, 3, 4].includes(DEVICE_DPR), '--dpr must be 1, 2, 3, or 4 (default 1)');
const ASSET_SUFFIX = DEVICE_DPR > 1 ? '@2x' : '';
const CANVAS_SIZE = DEVICE_DPR > 1 ? [768, 768] : [384, 384];
const ANCHORS = { strike: [176 / 384, 272 / 384], ground: [176 / 384, 360 / 384] };
const VIEWPORTS = [
  { width: 320, height: 568 },
  { width: 390, height: 844 },
  { width: 390, height: 1200 },
  { width: 390, height: 610 },
  { width: 390, height: 568 },
  { width: 844, height: 390 },
  { width: 720, height: 700 },
  { width: 1440, height: 900 },
];

function close(actual, expected, message, tolerance = 1) {
  assert.ok(Number.isFinite(actual) && Math.abs(actual - expected) <= tolerance,
    `${message}: expected ${expected}, got ${actual}`);
}

async function settle(page) {
  await page.evaluate(async () => {
    await Promise.all([...document.querySelectorAll('#player-main img')].map(image => image.decode().catch(() => {})));
    const main = document.getElementById('player-main');
    const finite = main.getAnimations({ subtree: true }).filter(animation => animation.effect.getTiming().iterations !== Infinity);
    await Promise.all(finite.map(animation => animation.finished.catch(() => {})));
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
}

async function setupFixture(page) {
  return page.evaluate(() => {
    LoginArt.setVisible(false);
    AudioManager.playEffect = async () => {};
    AudioManager.startLoop = async () => {};
    AudioManager.stopLoop = () => {};
    UI._updateMailBadge = () => {};
    UI._updateAchBadge = () => {};
    UI.toast = () => {};
    const axe = Object.values(ITEMS).find(item => item.type === 5 && item.quality === 1);
    const weapon = { id: 'wish-tree-fixture-axe', itemId: String(axe.id), skillRolls: [] };
    Game.state = { level: 1, realmLevel: 1, treeRealm: TREE_REALMS[0].level,
      treeLevel: TREE_REALMS[0].treeLevel, axeId: String(axe.id), axeInstanceId: weapon.id,
      coin: 1234, choppingCount: 50, exp: 0 };
    Game.inventory = [];
    Game.weapons = [weapon];
    Game.equippedWeapon = weapon;
    PlayerView.renderTasks = () => document.getElementById('player-main').replaceChildren();
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('player-dashboard').style.display = 'flex';
    window.wishTreeFixture = { detailCalls: 0, originalDetail: PlayerView.showTreeDetail,
      initialState: JSON.stringify(Game.state), initialInventory: JSON.stringify(Game.inventory) };
    PlayerView.showTreeDetail = function () {
      wishTreeFixture.detailCalls++;
      return wishTreeFixture.originalDetail.call(this);
    };
    Router.playerTab('cultivate', { force: true });
    CultivatorAnimator.stop();
    return { realmSkins: TREE_REALMS.map(realm => getTreeAppearance(realm).key),
      descriptors: Object.fromEntries(['tree_01', 'tree_02', 'tree_03', 'tree_04', 'tree_05'].map(key => [key, getTreeAppearance({ appearance: key })])),
      preloads: getInitialGameImageAssets(axe.id).filter(url => url.includes('/wish-trees/')) };
  });
}

async function renderSkin(page, key) {
  await page.mouse.move(0, 0);
  await page.evaluate(async key => {
    const realm = TREE_REALMS.find(entry => getTreeAppearance(entry).key === key);
    if (!realm) throw new Error(`Missing configured realm for ${key}`);
    Game.state.treeRealm = realm.level;
    Game.state.treeLevel = realm.treeLevel;
    await PlayerView.renderCultivate();
    CultivatorAnimator.stop();
    document.getElementById('cultivator-sprite').src = getAxeIdleFrames(Game.state.axeId)[0];
  }, key);
  await settle(page);
}

async function inspectScene(page, anchors) {
  return page.evaluate(anchors => {
    const tree = document.getElementById('tree-icon');
    const image = tree.querySelector('.tree-img');
    const character = document.getElementById('cultivator-sprite');
    const light = tree.querySelector('.tree-light');
    const crown = [Number(tree.dataset.crownX), Number(tree.dataset.crownY)];
    if (!image.complete || !image.naturalWidth) throw new Error(`Tree bitmap is not decoded: ${image.getAttribute('src')}`);
    if (light && (!light.complete || !light.naturalWidth)) throw new Error(`Tree light is not decoded: ${light.getAttribute('src')}`);
    if (!crown.every(value => Number.isFinite(value))) throw new Error('Tree crown metadata is missing');
    const scene = document.getElementById('tree-area');
    const box = node => {
      const { x, y, width, height, right, bottom } = node.getBoundingClientRect();
      return { x, y, width, height, right, bottom };
    };
    const imageBox = node => {
      const rect = box(node);
      const scale = Math.min(rect.width / node.naturalWidth, rect.height / node.naturalHeight);
      const width = node.naturalWidth * scale, height = node.naturalHeight * scale;
      const bottom = getComputedStyle(node).objectPosition.includes('100%') || getComputedStyle(node).objectPosition.includes('bottom');
      return { x: rect.x + (rect.width - width) / 2, y: rect.y + (rect.height - height) / (bottom ? 1 : 2), width, height };
    };
    const pixels = node => {
      const canvas = document.createElement('canvas');
      canvas.width = node.naturalWidth; canvas.height = node.naturalHeight;
      const context = canvas.getContext('2d', { willReadFrequently: true });
      context.drawImage(node, 0, 0);
      const rgba = context.getImageData(0, 0, canvas.width, canvas.height).data;
      let left = canvas.width, top = canvas.height, right = 0, bottom = 0, opaque = 0;
      for (let index = 3; index < rgba.length; index += 4) {
        if (rgba[index] < 16) continue;
        const pixel = (index - 3) / 4, x = pixel % canvas.width, y = Math.floor(pixel / canvas.width);
        opaque++; left = Math.min(left, x); top = Math.min(top, y);
        right = Math.max(right, x + 1); bottom = Math.max(bottom, y + 1);
      }
      return { rgba, width: canvas.width, height: canvas.height, opaque, bounds: [left, top, right, bottom] };
    };
    const basePixels = pixels(image), characterPixels = pixels(character);
    const baseBox = imageBox(image), charBox = imageBox(character);
    const point = coordinates => ({ x: baseBox.x + baseBox.width * coordinates[0], y: baseBox.y + baseBox.height * coordinates[1] });
    const nearestOpaque = coordinates => {
      const targetX = coordinates[0] * basePixels.width, targetY = coordinates[1] * basePixels.height;
      let nearest, distance = Infinity;
      for (let index = 3; index < basePixels.rgba.length; index += 4) {
        if (basePixels.rgba[index] < 100) continue;
        const pixel = (index - 3) / 4, x = pixel % basePixels.width, y = Math.floor(pixel / basePixels.width);
        const nextDistance = (x - targetX) ** 2 + (y - targetY) ** 2;
        if (nextDistance < distance) { distance = nextDistance; nearest = [x / basePixels.width, y / basePixels.height]; }
      }
      return point(nearest);
    };
    const hit = coordinates => {
      const target = document.elementFromPoint(coordinates.x, coordinates.y);
      return { ...coordinates, reachesTree: target === tree || tree.contains(target), target: target?.tagName + '.' + target?.className };
    };
    let lightState = null;
    if (light) {
      const lightPixels = pixels(light), style = getComputedStyle(light);
      let outsideBase = 0;
      for (let index = 3; index < lightPixels.rgba.length; index += 4) {
        if (lightPixels.rgba[index] >= 16 && basePixels.rgba[index] < 8) outsideBase++;
      }
      lightState = { src: light.getAttribute('src'), box: box(light), decoded: light.complete && light.naturalWidth > 0,
        size: [light.naturalWidth, light.naturalHeight], opacity: Number(style.opacity), pointer: style.pointerEvents,
        filter: style.filter, transform: style.transform, blend: style.mixBlendMode, bounds: lightPixels.bounds,
        visibleFraction: lightPixels.opaque / basePixels.opaque, outsideBase,
        animations: light.getAnimations().map(animation => ({ playState: animation.playState,
          duration: animation.effect.getTiming().duration, iterations: animation.effect.getTiming().iterations === Infinity ? 'infinite' : animation.effect.getTiming().iterations,
          frames: animation.effect.getKeyframes() })) };
    }
    return {
      source: image.getAttribute('src'), decoded: image.complete && image.naturalWidth > 0,
      size: [image.naturalWidth, image.naturalHeight], opaquePixels: basePixels.opaque, bounds: basePixels.bounds,
      image: box(image), imageContent: baseBox, tree: box(tree), scene: box(scene), character: box(character),
      characterFeet: charBox.y + charBox.height * characterPixels.bounds[3] / characterPixels.height,
      ground: point(anchors.ground), strike: point(anchors.strike), crown: point(crown),
      anchorData: { strike: [Number(tree.dataset.strikeX), Number(tree.dataset.strikeY)], crown },
      crownClick: hit(nearestOpaque(crown)), trunkClick: hit(nearestOpaque(anchors.strike)),
      treeZ: Number(getComputedStyle(tree).zIndex), characterZ: Number(getComputedStyle(character.parentElement).zIndex),
      characterPointer: getComputedStyle(character).pointerEvents, characterContainerPointer: getComputedStyle(character.parentElement).pointerEvents,
      baseAnimation: getComputedStyle(image).animationName, baseFilter: getComputedStyle(image).filter,
      visualAnimation: getComputedStyle(tree.querySelector('.tree-visual')).animationName,
      light: lightState, lightCount: tree.querySelectorAll('.tree-light').length,
      pageOverflow: document.documentElement.scrollWidth > innerWidth,
    };
  }, anchors);
}

function assertScene(snapshot, key, initial, canvasSize, preloads, expectedAnchors) {
  assert.equal(snapshot.decoded, true, `${key}: tree bitmap decodes`);
  assert.deepEqual(snapshot.size, canvasSize, `${key}: tree keeps the common transparent canvas`);
  assert.ok(snapshot.opaquePixels > 1000, `${key}: actual tree artwork is nonempty`);
  assert.ok(snapshot.source.includes(`/wish-trees/${key}${ASSET_SUFFIX}.webp?`), `${key}: configured skin and selected density are rendered`);
  assert.ok(preloads.includes(snapshot.source), `${key}: preload matches the exact rendered URL`);
  for (let coordinate = 0; coordinate < 2; coordinate++) close(snapshot.anchorData.strike[coordinate], ANCHORS.strike[coordinate], `${key}: strike data uses the measured normalized anchor`, .000001);
  assert.ok(snapshot.anchorData.crown.every(value => Number.isFinite(value) && value > 0 && value < 1), `${key}: crown metadata is normalized`);
  for (let coordinate = 0; coordinate < 2; coordinate++) close(snapshot.anchorData.crown[coordinate], expectedAnchors.crown[coordinate], `${key}: crown data agrees with the measured asset`, .000001);
  assert.equal(snapshot.pageOverflow, false, `${key}: no horizontal overflow`);
  assert.ok(snapshot.characterZ > snapshot.treeZ, `${key}: character stays in front of the tree`);
  assert.equal(snapshot.characterPointer, 'none');
  assert.equal(snapshot.characterContainerPointer, 'none');
  const artwork = {
    x: snapshot.imageContent.x + snapshot.imageContent.width * snapshot.bounds[0] / canvasSize[0],
    y: snapshot.imageContent.y + snapshot.imageContent.height * snapshot.bounds[1] / canvasSize[1],
    right: snapshot.imageContent.x + snapshot.imageContent.width * snapshot.bounds[2] / canvasSize[0],
    bottom: snapshot.imageContent.y + snapshot.imageContent.height * snapshot.bounds[3] / canvasSize[1],
  };
  assert.ok(artwork.x >= snapshot.scene.x - 1 && artwork.right <= snapshot.scene.right + 1,
    `${key}: visible branches stay inside the scene horizontally ${JSON.stringify({ artwork, scene: snapshot.scene })}`);
  assert.ok(artwork.y >= snapshot.scene.y - 1 && artwork.bottom <= snapshot.scene.bottom + 1,
    `${key}: crown and roots remain inside the scene ${JSON.stringify({ artwork, scene: snapshot.scene })}`);
  assert.equal(snapshot.crownClick.reachesTree, true, `${key}: crown remains clickable ${JSON.stringify(snapshot.crownClick)}`);
  assert.equal(snapshot.trunkClick.reachesTree, true, `${key}: trunk remains clickable behind the character ${JSON.stringify(snapshot.trunkClick)}`);
  assert.equal(snapshot.baseAnimation, 'none', `${key}: tree is stable; breathing belongs to extracted highlights only`);
  assert.equal(snapshot.baseFilter, 'none', `${key}: original tree artwork has no added whole-tree shadow or filter`);
  assert.equal(snapshot.visualAnimation, 'none', `${key}: the complete tree canvas does not breathe or sway`);
  if (initial) {
    close(snapshot.ground.y, initial.ground.y, `${key}: all skins share a ground baseline`);
    for (const coordinate of ['x', 'y']) close(snapshot.strike[coordinate], initial.strike[coordinate], `${key}: all skins share strike.${coordinate}`);
    for (const property of ['x', 'y', 'width', 'height']) close(snapshot.character[property], initial.character[property], `${key}: tree change does not move the character`);
  }
  assert.equal(snapshot.lightCount, 1, `${key}: one extracted original-art light layer`);
  if (snapshot.light) {
    const light = snapshot.light;
    assert.equal(light.decoded, true, `${key}: highlight image decodes`);
    assert.deepEqual(light.size, canvasSize);
    assert.ok(light.src.includes(`/wish-trees/light-${key.slice(-2)}${ASSET_SUFFIX}.webp?`), `${key}: light uses the selected density`);
    assert.ok(preloads.includes(light.src), `${key}: light preload has the exact runtime URL`);
    assert.equal(light.pointer, 'none');
    assert.equal(light.filter, 'none', `${key}: no whole-sprite lighting filter`);
    assert.equal(light.blend, 'screen', `${key}: original luminous pixels blend softly with their tree`);
    assert.equal(light.transform, 'none', `${key}: light stays attached to source art`);
    for (const property of ['x', 'y', 'width', 'height']) close(light.box[property], snapshot.image[property], `${key}: light canvas matches tree ${property}`);
    assert.ok(light.visibleFraction > 0 && light.visibleFraction < .3, `${key}: light is restricted to a small part of the tree`);
    assert.ok(light.outsideBase <= 4, `${key}: extracted light does not create outside glow geometry`);
    assert.equal(light.animations.length, 1, `${key}: one restrained breathing animation`);
    const animation = light.animations[0];
    assert.ok(animation.duration >= 7000 && animation.duration <= 9000, `${key}: breathing is slow`);
    assert.equal(animation.iterations, 'infinite');
    const opacities = animation.frames.map(frame => Number(frame.opacity));
    assert.ok(opacities.every(value => Number.isFinite(value) && value >= 0 && value <= .55));
    assert.ok(Math.max(...opacities) - Math.min(...opacities) <= .25, `${key}: breathing amplitude is low`);
    for (const frame of animation.frames) {
      const properties = Object.keys(frame).filter(name => !['offset', 'computedOffset', 'easing', 'composite'].includes(name));
      assert.deepEqual(properties, ['opacity'], `${key}: light animation changes opacity only`);
    }
  }
}

async function clickTreeDetail(page, point, expectedSource) {
  const before = await page.evaluate(() => wishTreeFixture.detailCalls);
  await page.mouse.click(point.x, point.y);
  await page.locator('.tree-detail-img').evaluate(image => image.decode());
  assert.equal(await page.locator('.tree-detail-img').getAttribute('src'), expectedSource,
    'the actual tree click opens detail with the currently configured skin');
  assert.equal(await page.evaluate(() => wishTreeFixture.detailCalls), before + 1);
  assert.equal(await page.locator('.modal-overlay').count(), 1, 'one tree click opens exactly one detail');
  await page.locator('.modal-overlay .modal-close').click();
  await page.mouse.move(0, 0);
  await settle(page);
}

async function checkUpgradeHint(page, key) {
  await page.evaluate(() => {
    const next = TREE_REALMS.find(realm => realm.level === Game.state.treeRealm + 1);
    if (!next?.reqItems?.length) throw new Error('Upgrade fixture needs a configured next realm');
    wishTreeFixture.savedInventory = Game.inventory;
    Game.inventory = next.reqItems.map(item => ({ itemId: String(item.itemId), quantity: item.count }));
    PlayerView.refreshInventoryConsumers();
  });
  const snapshots = [];
  for (const renderPath of ['refresh', 'render']) {
    if (renderPath === 'render') await page.evaluate(async () => { await PlayerView.renderCultivate(); CultivatorAnimator.stop(); });
    await settle(page);
    const samples = await page.evaluate(async () => {
      const hint = document.querySelector('#tree-icon .tree-upgrade-hint');
      if (!hint) throw new Error('Eligible tree is missing its upgrade hint');
      const tree = document.getElementById('tree-icon');
      const image = tree.querySelector('.tree-img');
      const rect = element => {
        const { x, y, width, height, right, bottom } = element.getBoundingClientRect();
        return { x, y, width, height, right, bottom };
      };
      const animations = hint.getAnimations();
      await Promise.all(animations.map(animation => animation.ready));
      const samples = [];
      for (const progress of [0, .5, .99]) {
        for (const animation of animations) { animation.pause(); animation.currentTime = Number(animation.effect.getTiming().duration) * progress; }
        const textRange = document.createRange(); textRange.selectNodeContents(hint);
        const style = getComputedStyle(hint), imageRect = image.getBoundingClientRect();
        samples.push({ progress, hint: rect(hint), text: rect(textRange), scene: rect(document.getElementById('tree-area')),
          viewport: { width: innerWidth, height: innerHeight }, opacity: Number(style.opacity), pointer: style.pointerEvents,
          label: hint.textContent, crownTop: imageRect.y + imageRect.height * getTreeAppearance(TREE_REALMS.find(realm => realm.level === Game.state.treeRealm)).crownTop });
      }
      return samples;
    });
    for (const sample of samples) {
      const { hint, scene, text, viewport } = sample;
      assert.equal(sample.label, '可升级');
      assert.equal(sample.pointer, 'none');
      assert.ok(sample.opacity >= .5, `${key}/${renderPath}: upgrade hint remains visible throughout its motion`);
      assert.ok(hint.x >= scene.x - 1 && hint.right <= scene.right + 1 && hint.y >= scene.y - 1 && hint.bottom <= scene.bottom + 1,
        `${key}/${renderPath}: upgrade hint is not clipped by the scene ${JSON.stringify(sample)}`);
      assert.ok(hint.x >= 0 && hint.right <= viewport.width && hint.y >= 0 && hint.bottom <= viewport.height,
        `${key}/${renderPath}: upgrade hint stays onscreen`);
      assert.ok(text.x >= hint.x - 1 && text.right <= hint.right + 1 && text.y >= hint.y - 1 && text.bottom <= hint.bottom + 1,
        `${key}/${renderPath}: upgrade text fits its hint`);
      assert.ok(Math.abs(hint.y - sample.crownTop) <= 20, `${key}/${renderPath}: hint follows the visible crown, not the transparent canvas edge`);
    }
    snapshots.push({ path: renderPath, minTopClearance: Math.min(...samples.map(sample => sample.hint.y - sample.scene.y)) });
  }
  await page.evaluate(() => { Game.inventory = wishTreeFixture.savedInventory; PlayerView.refreshInventoryConsumers(); });
  assert.equal(await page.locator('.tree-upgrade-hint').count(), 0, 'upgrade hint disappears immediately when materials are insufficient');
  return { key, snapshots };
}

async function checkLiveResize(page, manifest, preloads) {
  await page.evaluate(() => {
    wishTreeFixture.resizeNodes = ['#tree-icon', '#cultivator-sprite', '.mobile-scene-stage'].map(selector => document.querySelector(selector));
  });
  const states = [];
  for (const height of [610, 568, 1200, 844]) {
    await page.setViewportSize({ width: 390, height });
    await settle(page);
    assert.equal(await page.evaluate(() => ['#tree-icon', '#cultivator-sprite', '.mobile-scene-stage']
      .every((selector, index) => document.querySelector(selector) === wishTreeFixture.resizeNodes[index])), true,
    'height changes reuse the live scene instead of rebuilding the tree or character');
    const snapshot = await inspectScene(page, manifest.tree_05.anchors);
    assertScene(snapshot, 'tree_05', null, CANVAS_SIZE, preloads, manifest.tree_05.anchors);
    const ratio = snapshot.character.width / snapshot.image.width;
    if (states.length) close(ratio, states[0].ratio, 'resizing scales character and tree together', .00001);
    states.push({ height, ratio, treeSize: snapshot.image.width, strike: snapshot.strike });
  }
  return states;
}

async function inspectLightMotion(page) {
  return page.evaluate(() => [...document.querySelectorAll('#tree-icon .tree-light')].map(light => ({
    active: light.closest('#tree-icon').dataset.lightActive,
    visible: light.getClientRects().length > 0 && getComputedStyle(light).visibility !== 'hidden',
    opacity: Number(getComputedStyle(light).opacity),
    animation: getComputedStyle(light).animationName,
    playState: getComputedStyle(light).animationPlayState,
    running: light.getAnimations().filter(animation => animation.playState === 'running').length,
  })));
}

async function checkHitEffects(page, snapshot) {
  const steps = await page.evaluate(() => {
    const scene = document.getElementById('tree-area'), tree = document.getElementById('tree-icon');
    const sceneRect = scene.getBoundingClientRect();
    const scaleX = sceneRect.width / scene.offsetWidth, scaleY = sceneRect.height / scene.offsetHeight;
    const collect = speed => {
      CultivationEffects.clear();
      const count = CultivationEffects.playHit({ scene, tree, intensity: 1, speed });
      const nodes = [...scene.querySelectorAll('.cult-effect')];
      const point = node => ({ x: sceneRect.x + (parseFloat(node.style.left) + scene.clientLeft) * scaleX,
        y: sceneRect.y + (parseFloat(node.style.top) + scene.clientTop) * scaleY });
      const cut = nodes.find(node => node.dataset.effect === 'cut');
      const leaves = nodes.filter(node => node.dataset.effect === 'leaf');
      return { speed, count, cut: cut ? point(cut) : null, leaves: leaves.map(point),
        cutDelay: cut ? parseFloat(cut.style.getPropertyValue('--effect-delay')) : null,
        cutDuration: cut ? parseFloat(cut.style.getPropertyValue('--effect-duration')) : null,
        pointers: nodes.map(node => getComputedStyle(node).pointerEvents) };
    };
    const result = [collect(1), collect(3)];
    CultivationEffects.clear();
    return result;
  });
  for (const step of steps) {
    assert.equal(step.count, 5, 'each hit preserves one cut and four leaves');
    assert.equal(step.leaves.length, 4);
    assert.ok(step.pointers.every(pointer => pointer === 'none'), 'hit effects do not intercept tree clicks');
    close(step.cut.x, snapshot.strike.x, 'cut follows the measured trunk strike x', .2);
    close(step.cut.y, snapshot.strike.y, 'cut follows the measured trunk strike y', .2);
    close(step.cutDelay, 180 / step.speed, 'original impact delay follows chopping speed', .1);
    for (const leaf of step.leaves) {
      assert.ok(Math.abs(leaf.x - snapshot.crown.x) <= 24 && Math.abs(leaf.y - snapshot.crown.y) <= 10,
        'leaves originate from the configured crown, not the lower trunk');
    }
  }
  assert.ok(steps[1].cutDuration < steps[0].cutDuration, 'faster chopping still shortens hit effects');
  assert.equal(await page.locator('.cult-effect').count(), 0, 'effect cleanup removes all transient nodes');
  return steps.map(step => ({ speed: step.speed, count: step.count, strike: step.cut, delay: step.cutDelay }));
}

async function checkLifecycle(page) {
  const initial = await inspectLightMotion(page);
  assert.ok(initial.every(light => light.active === 'true' && light.running === 1), 'visible active trees have one breathing layer');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await settle(page);
  const reduced = await inspectLightMotion(page);
  assert.ok(reduced.every(light => light.active === 'false' && light.running === 0), 'reduced-motion mode stops decorative breathing');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await settle(page);
  const resumed = await inspectLightMotion(page);
  assert.equal(resumed.length, initial.length);
  assert.ok(resumed.every(light => light.running === 1), 'restoring motion preference resumes one light animation');

  await page.evaluate(() => {
    const tree = document.getElementById('tree-icon');
    wishTreeFixture.originalTreeTransform = tree.style.transform;
    tree.style.transform = 'translateY(-300vh)';
  });
  await page.waitForFunction(() => document.getElementById('tree-icon').dataset.lightActive === 'false', null, { timeout: 3000 });
  const offscreen = await inspectLightMotion(page);
  assert.ok(offscreen.every(light => light.running === 0), 'real intersection changes pause offscreen tree lighting');
  await page.evaluate(() => { document.getElementById('tree-icon').style.transform = wishTreeFixture.originalTreeTransform; });
  await page.waitForFunction(() => document.getElementById('tree-icon').dataset.lightActive === 'true', null, { timeout: 3000 });
  await settle(page);

  // Exercise the real visibilitychange handlers using a local document-state fixture.
  assert.equal(await page.evaluate(() => CultivationEffects.playHit({ scene: document.getElementById('tree-area'), tree: document.getElementById('tree-icon') })), 5);
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await settle(page);
  const hidden = await inspectLightMotion(page);
  assert.ok(hidden.every(light => light.active === 'false' && light.running === 0), 'hidden documents pause decorative work');
  assert.equal(await page.locator('.cult-effect').count(), 0, 'hidden documents clear transient hit effects');
  await page.evaluate(() => {
    delete document.hidden; delete document.visibilityState;
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await settle(page);
  const visibleAgain = await inspectLightMotion(page);
  assert.ok(visibleAgain.every(light => light.running === 1), 'visible active scene resumes decorative motion');

  const left = await page.evaluate(() => {
    const previousTree = document.getElementById('tree-icon');
    const previousStage = document.querySelector('.mobile-scene-stage');
    const previousLights = [...previousTree.querySelectorAll('.tree-light')];
    CultivationEffects.playHit({ scene: document.getElementById('tree-area'), tree: previousTree });
    Router.playerTab('tasks');
    return { treeConnected: previousTree.isConnected, active: previousTree.dataset.lightActive,
      stageTransform: previousStage.style.transform,
      running: previousLights.flatMap(light => light.getAnimations()).filter(animation => animation.playState === 'running').length,
      effectCount: document.querySelectorAll('.cult-effect').length };
  });
  assert.equal(left.treeConnected, false, 'leaving cultivation removes the retired tree');
  assert.equal(left.active, 'false', 'retired trees are explicitly detached from the light controller');
  assert.equal(left.stageTransform, '', 'leaving the scene removes its fitted scale');
  assert.equal(left.running, 0, 'retired trees have no ongoing light animation');
  assert.equal(left.effectCount, 0, 'leaving cultivation clears transient effects');
  await page.evaluate(() => { Router.playerTab('cultivate'); CultivatorAnimator.stop(); });
  await settle(page);
  const returned = await inspectLightMotion(page);
  assert.equal(returned.length, initial.length, 'returning creates only the current light layer');
  assert.ok(returned.every(light => light.running === 1));
  return { layers: initial.length, reduced, offscreen, hidden, left, returned };
}

async function main() {
  const root = path.resolve(__dirname, '..');
  const manifest = JSON.parse(await fs.readFile(path.join(root, 'assets/runtime/wish-trees/manifest.json'), 'utf8'));
  const requestedViewport = process.argv.find(argument => argument.startsWith('--viewport='))?.split('=')[1];
  const viewports = requestedViewport ? VIEWPORTS.filter(viewport => `${viewport.width}x${viewport.height}` === requestedViewport) : VIEWPORTS;
  assert.ok(viewports.length > 0, 'requested viewport must be one of the supported regression sizes');
  const playwright = require(process.env.PLAYWRIGHT_MODULE || 'C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
  const browser = await playwright.chromium.launch({ headless: true,
    executablePath: process.env.BROWSER_EXECUTABLE || 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const page = await browser.newPage({ deviceScaleFactor: DEVICE_DPR });
  const errors = [], requests = [], checks = [], treeRequests = [];
  page.on('pageerror', error => errors.push(error.message));
  try {
    await page.route('**/*', async route => {
      const request = route.request();
      const url = new URL(request.url());
      if (!['GET', 'HEAD'].includes(request.method()) || /supabase\./.test(url.hostname)) {
        requests.push(`${request.method()} ${url.origin}`);
        return route.abort();
      }
      if (url.origin !== 'http://wish-trees.local') return route.abort();
      if (url.pathname.startsWith('/assets/runtime/wish-trees/')) treeRequests.push(url.href);
      const relative = decodeURIComponent(url.pathname).replace(/^\//, '') || 'index.html';
      const file = path.resolve(root, relative);
      if (!file.startsWith(root + path.sep)) return route.abort();
      try {
        const body = await fs.readFile(file);
        const contentType = { '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript',
          '.webp': 'image/webp', '.svg': 'image/svg+xml', '.json': 'application/json' }[path.extname(file)] || 'application/octet-stream';
        await route.fulfill({ status: 200, body, contentType });
      } catch { await route.fulfill({ status: 404, body: '' }); }
    });

    for (const viewport of viewports) {
      treeRequests.length = 0;
      await page.setViewportSize(viewport);
      await page.goto('http://wish-trees.local');
      assert.equal(await page.evaluate(() => devicePixelRatio), DEVICE_DPR, 'browser uses the requested real device pixel ratio');
      const fixture = await setupFixture(page);
      assert.deepEqual([...new Set(fixture.realmSkins)].sort(), SKINS, 'the real configuration includes all five tree skins');
      assert.equal(fixture.preloads.length, 10, 'all five trees and five extracted light layers are preloaded');
      assert.equal(new Set(fixture.preloads).size, fixture.preloads.length, 'tree preloads have no duplicate URLs');
      assert.ok(fixture.preloads.every(url => url.includes('@2x') === (DEVICE_DPR > 1)),
        'preloading selects one density for both trees and lights');
      await page.evaluate(async urls => { await AssetPreloader.preload(urls); }, fixture.preloads);
      const states = [];
      const hints = [];
      let initial = null;
      for (const key of SKINS) {
        await renderSkin(page, key);
        const snapshot = await inspectScene(page, manifest[key].anchors);
        assertScene(snapshot, key, initial, CANVAS_SIZE, fixture.preloads, manifest[key].anchors);
        if (!initial) initial = snapshot;
        await clickTreeDetail(page, snapshot.crownClick, snapshot.source);
        await clickTreeDetail(page, snapshot.trunkClick, snapshot.source);
        const effects = await checkHitEffects(page, snapshot);
        hints.push(await checkUpgradeHint(page, key));
        states.push({ key, size: snapshot.size, image: snapshot.image, strike: snapshot.strike, ground: snapshot.ground,
          characterFeet: snapshot.characterFeet, lightCoverage: snapshot.light?.visibleFraction || 0,
          effectSteps: effects });
      }
      const aliases = await page.evaluate(() => Object.fromEntries(['sprout', 'spirit', 'divine', 'unknown', '', ' TREE_04 ']
        .map(appearance => [appearance, getTreeAppearance({ appearance }).key])));
      assert.deepEqual(aliases, { sprout: 'tree_01', spirit: 'tree_03', divine: 'tree_05', unknown: 'tree_01', '': 'tree_01', ' TREE_04 ': 'tree_04' });
      await page.evaluate(async () => {
        Game.state.treeRealm = TREE_REALMS.find(realm => getTreeAppearance(realm).key === 'tree_01').level;
        Game.state.treeLevel = Math.max(...Object.keys(TREE_LEVELS).map(Number));
        await PlayerView.renderCultivate();
        CultivatorAnimator.stop();
      });
      await settle(page);
      assert.ok((await page.locator('#tree-icon .tree-img').getAttribute('src')).includes(`/tree_01${ASSET_SUFFIX}.webp?`),
        'tree appearance follows its configured realm, independently of numerical reward-pool level');
      await renderSkin(page, 'tree_05');
      const resized = viewport.width === 390 && viewport.height === 844 ? await checkLiveResize(page, manifest, fixture.preloads) : null;
      const lifecycle = await checkLifecycle(page);
      assert.deepEqual(await page.evaluate(() => ({ coin: Game.state.coin, choppingCount: Game.state.choppingCount,
        exp: Game.state.exp, inventory: Game.inventory, weapons: Game.weapons.length })),
      { coin: 1234, choppingCount: 50, exp: 0, inventory: [], weapons: 1 }, 'art and detail checks do not change resources');
      const requestedTrees = [...new Set(treeRequests)].sort();
      assert.deepEqual(requestedTrees, fixture.preloads.map(url => new URL(url, 'http://wish-trees.local').href).sort(),
        'actual preload, scene, and detail requests share exactly ten selected URLs without fetching both densities');
      checks.push({ viewport, devicePixelRatio: DEVICE_DPR, requestedTrees: requestedTrees.length,
        skins: states, hints, resized, detailClicks: await page.evaluate(() => wishTreeFixture.detailCalls), aliases, lifecycle });
    }
    assert.deepEqual(errors, []);
    assert.deepEqual(requests, [], 'no player/account/database requests are attempted');
    const summary = checks.map(check => ({ viewport: check.viewport, devicePixelRatio: check.devicePixelRatio,
      canvasSize: CANVAS_SIZE, selectedDensityRequests: check.requestedTrees,
      sceneImageWidth: check.skins[0].image.width, strike: check.skins[0].strike,
      skins: check.skins.map(skin => skin.key),
      detailClicks: check.detailClicks,
      maxStrikeShift: Math.max(...check.skins.flatMap(skin => ['x', 'y'].map(axis => Math.abs(skin.strike[axis] - check.skins[0].strike[axis])))),
      groundOffsets: check.skins.map(skin => Math.round((skin.ground.y - skin.characterFeet) * 10) / 10),
      lightCoverage: check.skins.map(skin => Math.round(skin.lightCoverage * 1000) / 10),
      upgradeHints: check.hints.length, minHintTopClearance: Math.min(...check.hints.flatMap(hint => hint.snapshots.map(snapshot => snapshot.minTopClearance))),
      liveResize: check.resized,
      lifecycle: { lightLayers: check.lifecycle.layers, reducedRunning: check.lifecycle.reduced.map(light => light.running),
        offscreenRunning: check.lifecycle.offscreen.map(light => light.running),
        hiddenRunning: check.lifecycle.hidden.map(light => light.running), left: check.lifecycle.left } }));
    console.log(JSON.stringify({ ok: true, pageErrors: errors, unexpectedRequests: requests,
      checks: process.env.WISH_TREE_VERBOSE ? checks : summary }, null, 2));
  } finally { await browser.close(); }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
