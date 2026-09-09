const test = require('node:test');
const assert = require('node:assert/strict');
const { AUDIO_PATHS, AUDIO_VOLUMES, createAudioManager } = require('../audio-manager');

class FakeAudio {
  static instances = [];

  constructor(src = '') {
    this.src = src;
    this.loop = false;
    this.volume = 1;
    this.currentTime = 0;
    this.paused = true;
    this.listeners = {};
    FakeAudio.instances.push(this);
  }

  addEventListener(name, handler) {
    this.listeners[name] = handler;
  }

  load() {}

  play() {
    this.paused = false;
    return Promise.resolve();
  }

  pause() {
    this.paused = true;
  }
}

function createStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: key => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, String(value)),
  };
}

function freshManager(options = {}) {
  FakeAudio.instances = [];
  return createAudioManager({ AudioCtor: FakeAudio, storage: createStorage(), ...options });
}

test('audio paths cover the supplied BGM, six legacy effects and four reward cues', () => {
  assert.deepEqual(Object.keys(AUDIO_PATHS).sort(), [
    'bgmMain', 'chopHit', 'dropHigh', 'dropRare', 'forgeProcess', 'forgeSuccess',
    'itemDrop', 'rewardReveal', 'skillTrigger', 'uiOpen', 'uiTap',
  ]);
  Object.values(AUDIO_PATHS).forEach(src => assert.match(src, /^assets\/runtime\/audio\//));
});

test('category mix keeps UI feedback audible above the restrained BGM', () => {
  assert.deepEqual(AUDIO_VOLUMES, {
    bgmMain: 0.18,
    uiTap: 0.62,
    uiOpen: 0.58,
    chopHit: 0.64,
    itemDrop: 0.62,
    forgeProcess: 0.38,
    forgeSuccess: 0.70,
    dropRare: 0.64,
    dropHigh: 0.68,
    rewardReveal: 0.48,
    skillTrigger: 0.74,
  });
});

test('sound effects use independent audio instances so repeated actions can overlap', async () => {
  const manager = freshManager();
  await Promise.all([manager.playEffect('chopHit'), manager.playEffect('chopHit')]);
  assert.equal(FakeAudio.instances.length, 2);
  assert.notEqual(FakeAudio.instances[0], FakeAudio.instances[1]);
});

test('BGM is a single looping instance and pauses on mute', async () => {
  const storage = createStorage();
  const manager = freshManager({ storage });
  await manager.playBgm();
  await manager.playBgm();
  assert.equal(FakeAudio.instances.length, 1);
  assert.equal(FakeAudio.instances[0].loop, true);
  assert.equal(FakeAudio.instances[0].paused, false);

  manager.setMuted(true);
  assert.equal(FakeAudio.instances[0].paused, true);
  assert.equal(storage.getItem('growth-partner-audio-muted'), 'true');

  manager.setMuted(false);
  await Promise.resolve();
  assert.equal(FakeAudio.instances[0].paused, false);
});

test('looping process audio stops and resets cleanly', async () => {
  const manager = freshManager();
  await manager.startLoop('forgeProcess');
  const process = FakeAudio.instances[0];
  assert.equal(process.loop, true);
  manager.stopLoop('forgeProcess');
  assert.equal(process.paused, true);
  assert.equal(process.currentTime, 0);
});

test('muting immediately stops an effect already in progress', async () => {
  const manager = freshManager();
  await manager.playEffect('itemDrop');
  const effect = FakeAudio.instances[0];
  assert.equal(effect.paused, false);
  manager.setMuted(true);
  assert.equal(effect.paused, true);
  assert.equal(effect.currentTime, 0);
});

test('saved mute state is restored and rejected playback is harmless', async () => {
  class RejectingAudio extends FakeAudio {
    play() { return Promise.reject(new Error('autoplay blocked')); }
  }
  const manager = createAudioManager({
    AudioCtor: RejectingAudio,
    storage: createStorage({ 'growth-partner-audio-muted': 'true' }),
  });
  assert.equal(manager.isMuted(), true);
  assert.equal(await manager.playEffect('uiTap'), false);

  manager.setMuted(false);
  assert.equal(await manager.playEffect('uiTap'), false);
});

test('a later user click retries BGM when the browser blocked or paused it', async () => {
  const documentRef = {
    clickHandler: null,
    addEventListener(name, handler) {
      if (name === 'click') this.clickHandler = handler;
    },
    querySelectorAll() { return []; },
  };
  const manager = freshManager({ documentRef });
  await manager.playBgm();
  const bgm = FakeAudio.instances[0];
  bgm.pause();
  manager.bindControls();

  documentRef.clickHandler({
    target: {
      closest: () => ({
        matches: () => false,
        getAttribute: () => null,
        classList: { contains: () => false },
      }),
    },
  });
  await Promise.resolve();
  assert.equal(bgm.paused, false);
});

test('audio construction failures do not reject playback or login preload', async () => {
  class ThrowingAudio {
    constructor() { throw new Error('codec unavailable'); }
  }
  const manager = createAudioManager({ AudioCtor: ThrowingAudio, storage: createStorage() });
  assert.equal(await manager.playEffect('uiOpen'), false);
  const result = await manager.preload(1);
  assert.equal(result.total, 11);
  assert.equal(result.failed.length, 11);
});

test('reward groups limit overlap without cutting already playing tails', async () => {
  const manager = freshManager();
  for (let i = 0; i < 3; i++) {
    assert.equal(await manager.playEffect('rewardReveal', { group: 'reward-dialog' }), true);
  }
  assert.equal(await manager.playEffect('skillTrigger', { group: 'reward-dialog' }), false);
  assert.equal(FakeAudio.instances.length, 3);
  assert.ok(FakeAudio.instances.every(audio => !audio.paused));
  assert.equal(await manager.playEffect('dropHigh', { group: 'scene' }), true);
  FakeAudio.instances[0].onended();
  assert.equal(FakeAudio.instances[0].onended, null);
  assert.equal(FakeAudio.instances[0].onerror, null);
  assert.equal(await manager.playEffect('skillTrigger', { group: 'reward-dialog' }), true);
});

test('cancelling one group clears its references without stopping other feedback or loops', async () => {
  const manager = freshManager();
  await manager.playEffect('rewardReveal', { group: 'reward-dialog' });
  const reward = FakeAudio.instances.at(-1);
  await manager.playEffect('chopHit', { group: 'scene' });
  const chop = FakeAudio.instances.at(-1);
  await manager.playBgm();
  const bgm = FakeAudio.instances.at(-1);
  await manager.startLoop('forgeProcess');
  const loop = FakeAudio.instances.at(-1);
  manager.stopEffects('reward-dialog');
  assert.equal(reward.paused, true);
  assert.equal(reward.currentTime, 0);
  assert.equal(reward.onended, null);
  assert.equal(reward.onerror, null);
  assert.equal(chop.paused, false);
  assert.equal(bgm.paused, false);
  assert.equal(loop.paused, false);
  manager.stopEffects();
  assert.equal(chop.paused, true);
  assert.equal(bgm.paused, false);
  assert.equal(loop.paused, false);
});

test('new skill cue stays clear while replacing only its own reveal tail', async () => {
  const manager = freshManager();
  await manager.playBgm();
  const bgm = FakeAudio.instances.at(-1);
  await manager.playEffect('skillTrigger', { group: 'chop-refunds', volumeScale: .8 });
  const refund = FakeAudio.instances.at(-1);
  await manager.playEffect('rewardReveal', { group: 'reward-dialog' });
  const tail = FakeAudio.instances.at(-1);
  manager.stopEffects('reward-dialog');
  await manager.playEffect('skillTrigger', { group: 'reward-dialog' });
  const skill = FakeAudio.instances.at(-1);
  assert.equal(tail.paused, true);
  assert.equal(bgm.paused, false);
  assert.equal(bgm.volume, .18);
  assert.equal(refund.paused, false);
  assert.equal(refund.volume, .74 * .8);
  assert.equal(skill.src, 'assets/runtime/audio/skill-trigger.wav?v=skill-v2-20260909');
  assert.equal(skill.volume, .74);
  assert.equal(skill.playbackRate, 1);
  manager.stopEffects('reward-dialog');
  assert.equal(skill.paused, true);
  assert.equal(refund.paused, false);
  assert.equal(bgm.paused, false);
  manager.setMuted(true);
  assert.equal(refund.paused, true);
  assert.equal(bgm.paused, true);
});

test('volume and playback speed are bounded per effect without changing the shared mix', async () => {
  const manager = freshManager();
  await manager.playEffect('rewardReveal', { volumeScale: 0.5, playbackRate: 1.1 });
  assert.equal(FakeAudio.instances.at(-1).volume, AUDIO_VOLUMES.rewardReveal * 0.5);
  assert.equal(FakeAudio.instances.at(-1).playbackRate, 1.1);
  await manager.playEffect('dropHigh', { volumeScale: 100, playbackRate: 100 });
  assert.equal(FakeAudio.instances.at(-1).volume, 1);
  assert.equal(FakeAudio.instances.at(-1).playbackRate, 2);
  await manager.playEffect('skillTrigger', { volumeScale: -4, playbackRate: -4 });
  assert.equal(FakeAudio.instances.at(-1).volume, 0);
  assert.equal(FakeAudio.instances.at(-1).playbackRate, 0.5);
  manager.stopEffects();
  await manager.playEffect('itemDrop', { volumeScale: NaN, playbackRate: Infinity });
  assert.equal(FakeAudio.instances.at(-1).volume, AUDIO_VOLUMES.itemDrop);
  assert.equal(FakeAudio.instances.at(-1).playbackRate, 1);
});

test('global feedback limit is bounded even with unique groups', async () => {
  const manager = freshManager();
  for (let i = 0; i < 12; i++) {
    assert.equal(await manager.playEffect('rewardReveal', { group: `item-${i}` }), true);
  }
  assert.equal(await manager.playEffect('rewardReveal', { group: 'extra' }), false);
  assert.equal(FakeAudio.instances.length, 12);
  manager.stopEffects();
  assert.equal(await manager.playEffect('rewardReveal', { group: 'extra' }), true);
});

test('muting clears every group and unmuting never resumes one-shot cues', async () => {
  const manager = freshManager();
  await manager.playEffect('rewardReveal', { group: 'reward-dialog' });
  await manager.playEffect('dropRare', { group: 'scene' });
  const effects = [...FakeAudio.instances];
  manager.setMuted(true);
  assert.ok(effects.every(audio => audio.paused && audio.onended === null && audio.onerror === null));
  assert.equal(await manager.playEffect('skillTrigger', { group: 'reward-dialog' }), false);
  manager.setMuted(false);
  assert.ok(effects.every(audio => audio.paused));
  assert.equal(await manager.playEffect('skillTrigger', { group: 'reward-dialog' }), true);
});

test('group cancellation wins against a late successful play promise', async () => {
  const complete = [];
  class DeferredAudio extends FakeAudio {
    play() {
      return new Promise(resolve => complete.push(() => { this.paused = false; resolve(); }));
    }
  }
  const manager = freshManager({ AudioCtor: DeferredAudio });
  const pending = manager.playEffect('rewardReveal', { group: 'reward-dialog' });
  const audio = FakeAudio.instances[0];
  manager.stopEffects('reward-dialog');
  complete[0]();
  assert.equal(await pending, false);
  assert.equal(audio.paused, true);
  assert.equal(audio.onended, null);
  assert.equal(audio.onerror, null);
});

test('audio errors and denied playback immediately release group capacity', async () => {
  const manager = freshManager();
  await manager.playEffect('rewardReveal', { group: 'reward-dialog' });
  const audio = FakeAudio.instances[0];
  audio.onerror();
  assert.equal(audio.onended, null);
  assert.equal(audio.onerror, null);
  for (let i = 0; i < 3; i++) {
    assert.equal(await manager.playEffect('rewardReveal', { group: 'reward-dialog' }), true);
  }
  class RejectingAudio extends FakeAudio {
    play() { return Promise.reject(new Error('blocked')); }
  }
  const rejected = freshManager({ AudioCtor: RejectingAudio });
  for (let i = 0; i < 4; i++) {
    assert.equal(await rejected.playEffect('rewardReveal', { group: 'reward-dialog' }), false);
  }
  assert.equal(FakeAudio.instances.length, 4);
  assert.ok(FakeAudio.instances.every(item => item.onended === null && item.onerror === null));
});
