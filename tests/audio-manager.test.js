const test = require('node:test');
const assert = require('node:assert/strict');
const { AUDIO_PATHS, createAudioManager } = require('../audio-manager');

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

test('audio paths cover the supplied BGM and six effects', () => {
  assert.deepEqual(Object.keys(AUDIO_PATHS).sort(), [
    'bgmMain', 'chopHit', 'forgeProcess', 'forgeSuccess', 'itemDrop', 'uiOpen', 'uiTap',
  ]);
  Object.values(AUDIO_PATHS).forEach(src => assert.match(src, /^assets\/runtime\/audio\//));
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
  assert.equal(result.total, 7);
  assert.equal(result.failed.length, 7);
});
