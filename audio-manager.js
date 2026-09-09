(function initAudioManager(root) {
  const AUDIO_PATHS = Object.freeze({
    bgmMain: 'assets/runtime/audio/bgm-main.mp3',
    uiTap: 'assets/runtime/audio/ui-tap.wav',
    uiOpen: 'assets/runtime/audio/ui-open.wav',
    chopHit: 'assets/runtime/audio/chop-hit.wav',
    itemDrop: 'assets/runtime/audio/item-drop.wav',
    forgeProcess: 'assets/runtime/audio/forge-process.wav',
    forgeSuccess: 'assets/runtime/audio/forge-success.wav',
    dropRare: 'assets/runtime/audio/drop-rare.wav',
    dropHigh: 'assets/runtime/audio/drop-high.wav',
    rewardReveal: 'assets/runtime/audio/reward-reveal.wav',
    skillTrigger: 'assets/runtime/audio/skill-trigger.wav',
  });

  const AUDIO_VOLUMES = Object.freeze({
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
    skillTrigger: 0.68,
  });

  const MUTE_STORAGE_KEY = 'growth-partner-audio-muted';
  const GROUP_EFFECT_LIMIT = 3;
  const TOTAL_EFFECT_LIMIT = 12;

  function boundedNumber(value, minimum, maximum, fallback) {
    const number = Number(value);
    return Number.isFinite(number) ? Math.min(maximum, Math.max(minimum, number)) : fallback;
  }

  function createAudioManager(options = {}) {
    const AudioCtor = options.AudioCtor || root.Audio;
    const storage = options.storage || root.localStorage;
    const documentRef = options.documentRef || root.document;
    const loops = new Map();
    const activeEffects = new Map();
    let bgm = null;
    let wantsBgm = false;
    let controlsBound = false;
    let muted = false;

    try {
      muted = storage?.getItem(MUTE_STORAGE_KEY) === 'true';
    } catch (error) {
      muted = false;
    }

    function createAudio(name) {
      const src = AUDIO_PATHS[name];
      if (!src || !AudioCtor) return null;
      try {
        const audio = new AudioCtor(src);
        audio.preload = 'auto';
        audio.volume = AUDIO_VOLUMES[name] ?? 0.3;
        return audio;
      } catch (error) {
        console.debug?.('Audio could not be created:', error?.message || error);
        return null;
      }
    }

    async function safePlay(audio) {
      if (!audio || muted) return false;
      try {
        const result = audio.play();
        if (result && typeof result.then === 'function') await result;
        return true;
      } catch (error) {
        console.debug?.('Audio playback skipped:', error?.message || error);
        return false;
      }
    }

    function syncControls() {
      documentRef?.querySelectorAll?.('.audio-toggle').forEach(control => {
        control.classList.toggle('is-muted', muted);
        control.setAttribute('aria-pressed', String(muted));
        control.setAttribute('aria-label', muted ? '开启声音' : '关闭声音');
        control.setAttribute('title', muted ? '开启声音' : '关闭声音');
      });
    }

    function setMuted(value) {
      muted = Boolean(value);
      try {
        storage?.setItem(MUTE_STORAGE_KEY, String(muted));
      } catch (error) {
        console.debug?.('Audio preference was not persisted:', error?.message || error);
      }

      if (muted) {
        bgm?.pause?.();
        loops.forEach(audio => audio.pause?.());
        stopEffects();
      } else {
        if (wantsBgm) void safePlay(bgm);
        loops.forEach(audio => void safePlay(audio));
      }
      syncControls();
      return muted;
    }

    function toggleMuted() {
      return setMuted(!muted);
    }

    function resetEffect(audio) {
      audio.pause?.();
      try {
        audio.currentTime = 0;
      } catch (error) {
        // An unloaded or failed media resource may not have a seekable timeline.
      }
    }

    function stopEffects(group) {
      for (const [audio, effect] of activeEffects) {
        if (group !== undefined && effect.group !== group) continue;
        effect.release();
        resetEffect(audio);
      }
    }

    async function playEffect(name, effectOptions = {}) {
      if (muted) return false;
      const settings = effectOptions || {};
      const group = typeof settings.group === 'string' && settings.group ? settings.group : name;
      const count = [...activeEffects.values()].filter(effect => effect.group === group).length;
      // Skip excess cues instead of interrupting the tails of sounds already playing.
      if (count >= GROUP_EFFECT_LIMIT || activeEffects.size >= TOTAL_EFFECT_LIMIT) return false;
      const audio = createAudio(name);
      if (!audio) return false;
      audio.volume = Math.min(1, audio.volume * boundedNumber(settings.volumeScale, 0, 2, 1));
      audio.playbackRate = boundedNumber(settings.playbackRate, 0.5, 2, 1);
      const release = () => {
        audio.onended = null;
        audio.onerror = null;
        activeEffects.delete(audio);
      };
      activeEffects.set(audio, { group, release });
      audio.onended = release;
      audio.onerror = release;
      const played = await safePlay(audio);
      if (!played || muted || !activeEffects.has(audio)) {
        release();
        resetEffect(audio);
        return false;
      }
      return true;
    }

    async function playBgm() {
      wantsBgm = true;
      if (!bgm) {
        bgm = createAudio('bgmMain');
        if (bgm) bgm.loop = true;
      }
      return safePlay(bgm);
    }

    function pauseBgm() {
      wantsBgm = false;
      bgm?.pause?.();
    }

    async function startLoop(name) {
      let audio = loops.get(name);
      if (!audio) {
        audio = createAudio(name);
        if (!audio) return false;
        audio.loop = true;
        loops.set(name, audio);
      }
      audio.currentTime = 0;
      return safePlay(audio);
    }

    function stopLoop(name) {
      const audio = loops.get(name);
      if (!audio) return;
      audio.pause?.();
      audio.currentTime = 0;
      loops.delete(name);
    }

    async function preload(timeoutMs = 3000) {
      if (!AudioCtor) return { total: 0, failed: Object.keys(AUDIO_PATHS) };
      const failed = [];
      await Promise.all(Object.entries(AUDIO_PATHS).map(([name, src]) => new Promise(resolve => {
        const audio = createAudio(name);
        if (!audio) {
          failed.push(src);
          resolve();
          return;
        }
        let settled = false;
        const finish = ok => {
          if (settled) return;
          settled = true;
          if (!ok) failed.push(src);
          resolve();
        };
        audio.addEventListener?.('canplaythrough', () => finish(true), { once: true });
        audio.addEventListener?.('error', () => finish(false), { once: true });
        audio.load?.();
        setTimeout(() => finish(true), timeoutMs);
      })));
      return { total: Object.keys(AUDIO_PATHS).length, failed };
    }

    function bindControls() {
      if (!documentRef || controlsBound) {
        syncControls();
        return;
      }
      controlsBound = true;
      documentRef.addEventListener('click', event => {
        if (wantsBgm && bgm?.paused) void safePlay(bgm);
        const target = event.target?.closest?.('button, .nav-item, .status-mail, .cult-tree, .filter-chip, .inventory-tab');
        if (!target || target.matches?.(':disabled') || target.getAttribute?.('aria-disabled') === 'true') return;
        if (target.classList?.contains('audio-toggle')) {
          const nowMuted = toggleMuted();
          if (!nowMuted) void playEffect('uiTap');
          return;
        }
        void playEffect('uiTap');
      });
      syncControls();
    }

    return {
      playEffect,
      stopEffects,
      playBgm,
      pauseBgm,
      startLoop,
      stopLoop,
      setMuted,
      toggleMuted,
      isMuted: () => muted,
      preload,
      bindControls,
      syncControls,
    };
  }

  const AudioManager = createAudioManager();
  root.AudioManager = AudioManager;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { AUDIO_PATHS, AUDIO_VOLUMES, MUTE_STORAGE_KEY, createAudioManager };
  }
})(typeof globalThis !== 'undefined' ? globalThis : window);
