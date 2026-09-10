const test = require('node:test');
const assert = require('node:assert/strict');
const { createAudioManager, AUDIO_PATHS, AUDIO_VOLUMES } = require('../audio-manager');

function fixture({ decodeFails = false, contextFails = false, fetchHangs = false } = {}) {
  const sources = [], gains = [], media = [], requests = [], handlers = new Map();
  let ctx;
  class Context {
    constructor(options) {
      if (contextFails) throw new Error('unavailable');
      ctx = this;
      this.options = options;
      this.state = 'suspended';
      this.destination = {};
      this.decoded = 0;
    }
    async decodeAudioData(bytes) {
      this.decoded++;
      if (decodeFails) throw new Error('bad codec');
      return { bytes };
    }
    async resume() { this.state = 'running'; }
    createBufferSource() {
      const source = { playbackRate: { value: 1 }, starts: 0, stops: 0,
        connect() {}, disconnect() { this.disconnected = true; },
        start(when) { this.starts++; this.when = when; }, stop() { this.stops++; } };
      sources.push(source);
      return source;
    }
    createGain() {
      const gain = { gain: { value: 1 }, connect() {}, disconnect() { this.disconnected = true; } };
      gains.push(gain);
      return gain;
    }
  }
  class Media {
    constructor(src) { this.src = src; this.paused = true; media.push(this); }
    async play() { this.paused = false; }
    pause() { this.paused = true; }
  }
  const manager = createAudioManager({ AudioCtor: Media, AudioContextCtor: Context,
    storage: { getItem() {}, setItem() {} },
    fetch: async (url, settings) => {
      requests.push({ url, signal: settings.signal });
      if (fetchHangs) return new Promise(() => {});
      return { ok: true, arrayBuffer: async () => new ArrayBuffer(4) };
    },
    documentRef: { querySelectorAll: () => [], addEventListener(name, handler, options) {
      handlers.set(name, { handler, options });
    } },
  });
  return { manager, sources, gains, media, requests, handlers, context: () => ctx };
}

test('one interactive context decodes every short cue once before play; BGM stays streaming', async () => {
  const f = fixture();
  const results = await Promise.all([f.manager.prepareEffects(), f.manager.prepareEffects()]);
  assert.deepEqual(results[0], { total: 12, failed: [] });
  assert.equal(f.context().options.latencyHint, 'interactive');
  assert.equal(f.context().state, 'suspended', 'preparation must not require an autoplay gesture');
  assert.equal(f.requests.length, 12);
  assert.ok(f.requests.every(({ url }) => url !== AUDIO_PATHS.bgmMain));
  await f.manager.prepareEffects();
  assert.equal(f.context().decoded, 12);
  await f.manager.playBgm();
  assert.equal(f.media.length, 1);
  assert.equal(f.media[0].src, AUDIO_PATHS.bgmMain);
  assert.equal(f.media[0].loop, true);
});

test('unlocked cues start synchronously from shared buffers with independent sources and unchanged mix', async () => {
  const f = fixture();
  await f.manager.prepareEffects();
  await f.context().resume();
  const first = f.manager.playEffect('rewardHigh', { volumeScale: .5, playbackRate: 1.1 });
  assert.equal(f.sources[0].starts, 1, 'sound starts before the returned promise settles');
  assert.equal(f.sources[0].when, 0);
  const second = f.manager.playEffect('rewardHigh');
  assert.equal(f.sources[1].starts, 1);
  assert.equal(f.sources[0].buffer, f.sources[1].buffer);
  assert.equal(f.sources[0].playbackRate.value, 1.1);
  assert.equal(f.gains[0].gain.value, AUDIO_VOLUMES.rewardHigh * .5);
  assert.equal(f.gains[1].gain.value, AUDIO_VOLUMES.rewardHigh);
  assert.deepEqual(await Promise.all([first, second]), [true, true]);
  assert.equal(f.media.length, 0);
  assert.equal(f.requests.length, 12, 'playing never performs another download or decode');
  f.manager.stopEffects();
});

test('buffered sounds preserve group limits, natural tail release and selective cancellation', async () => {
  const f = fixture();
  await f.manager.prepareEffects();
  for (let n = 0; n < 3; n++) assert.equal(await f.manager.playEffect('rewardHigh', { group: 'reward' }), true);
  assert.equal(await f.manager.playEffect('skillTrigger', { group: 'reward' }), false);
  await f.manager.playEffect('chopHit', { group: 'scene' });
  const scene = f.sources.at(-1);
  f.sources[0].onended();
  assert.equal(f.sources[0].disconnected, true);
  assert.equal(f.gains[0].disconnected, true);
  assert.equal(await f.manager.playEffect('skillTrigger', { group: 'reward' }), true);
  f.manager.stopEffects('reward');
  assert.equal(scene.stops, 0);
  assert.ok(f.sources.filter(source => source !== scene).every(source => source.stops === 1 && source.onended === null));
  f.manager.stopEffects();
  assert.equal(scene.stops, 1);
});

test('buffered loops restart after mute but never return after stop or background suspension', async () => {
  const f = fixture();
  await f.manager.prepareEffects();
  await f.manager.startLoop('forgeProcess');
  assert.equal(f.sources[0].loop, true);
  f.manager.setMuted(true);
  assert.equal(f.sources[0].stops, 1);
  f.manager.setMuted(false);
  assert.equal(f.sources.length, 2);
  assert.equal(f.sources[1].loop, true);
  f.manager.stopLoop('forgeProcess');
  assert.equal(f.sources[1].stops, 1);
  await f.manager.startLoop('forgeProcess');
  await f.manager.playEffect('uiTap');
  f.manager.setSuspended(true);
  assert.ok(f.sources.every(source => source.stops === 1));
  assert.equal(await f.manager.playEffect('uiTap'), false);
  f.manager.setSuspended(false);
  f.manager.setMuted(true);
  f.manager.setMuted(false);
  assert.equal(f.sources.length, 4);
});

test('cancellation during context resume cannot create a delayed sound after the dialog closes', async () => {
  for (const kind of ['effect', 'loop']) {
    const f = fixture();
    await f.manager.prepareEffects();
    let resume;
    f.context().resume = () => new Promise(resolve => { resume = () => { f.context().state = 'running'; resolve(); }; });
    const play = kind === 'effect' ? f.manager.playEffect('rewardHigh', { group: 'reward' }) : f.manager.startLoop('forgeProcess');
    if (kind === 'effect') f.manager.stopEffects('reward');
    else f.manager.stopLoop('forgeProcess');
    resume();
    assert.equal(await play, false);
    assert.equal(f.sources.length, 0);
  }
});

test('input unlocks context early and captured clicks emit exactly one cue', async () => {
  const f = fixture();
  await f.manager.prepareEffects();
  f.manager.bindControls();
  f.handlers.get('pointerdown').handler();
  assert.equal(f.context().state, 'running');
  assert.equal(f.sources.length, 0, 'pointerdown only unlocks: scrolling does not make tap sounds');
  const click = f.handlers.get('click');
  assert.equal(click.options.capture, true);
  click.handler({ target: { closest: () => ({ matches: () => false, getAttribute: () => null }) } });
  assert.equal(f.sources.length, 1);
  assert.equal(f.sources[0].starts, 1);
  f.manager.stopEffects();
});

test('muting while resume is pending discards old cues even if unmuted again', async () => {
  const f = fixture();
  await f.manager.prepareEffects();
  let resume;
  f.context().resume = () => new Promise(resolve => { resume = () => { f.context().state = 'running'; resolve(); }; });
  const pending = f.manager.playEffect('uiTap');
  f.manager.setMuted(true);
  f.manager.setMuted(false);
  resume();
  assert.equal(await pending, false);
  assert.equal(f.sources.length, 0);
});

test('unsupported context or decode errors fall back to playable media without blocking preparation', async () => {
  for (const options of [{ contextFails: true }, { decodeFails: true }]) {
    const f = fixture(options);
    const result = await f.manager.prepareEffects();
    assert.equal(result.failed.length, 12);
    assert.equal(await f.manager.playEffect('uiTap'), true);
    assert.equal(f.media.length, 1);
    assert.equal(f.media[0].src, AUDIO_PATHS.uiTap);
    f.manager.stopEffects();
  }
});

test('stalled audio preparation is bounded and aborts downloads instead of blocking login forever', async () => {
  const f = fixture({ fetchHangs: true });
  assert.equal((await f.manager.prepareEffects(5)).failed.length, 12);
  assert.ok(f.requests.every(request => request.signal.aborted));
  assert.equal(await f.manager.playEffect('uiOpen'), true);
  f.manager.stopEffects();
});
