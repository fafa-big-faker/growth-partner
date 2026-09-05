(function initCharacterAnimator(root) {
  function createFrameAnimator(options) {
    const idleFrames = [...(options.idleFrames || [])];
    const chopFrames = [...(options.chopFrames || [])];
    const idleFrameMs = options.idleFrameMs || 200;
    const chopFrameMs = options.chopFrameMs || 90;
    const idlePauseMs = Math.max(0, options.idlePauseMs || 0);
    const onFrame = typeof options.onFrame === 'function' ? options.onFrame : null;
    let element = null;
    let timer = null;
    let sequence = 0;
    let idleIndex = 0;
    let pendingChopResolve = null;

    function clearTimer() {
      if (timer !== null) clearTimeout(timer);
      timer = null;
    }

    function cancelPendingChop() {
      if (!pendingChopResolve) return;
      const resolve = pendingChopResolve;
      pendingChopResolve = null;
      resolve(false);
    }

    function setFrame(frame, mode, index) {
      if (!element || !frame) return;
      element.src = frame;
      if (element.dataset) element.dataset.animationState = mode;
      if (onFrame) onFrame({ frame, state: mode, index, element });
    }

    function startIdle(token) {
      if (!element || idleFrames.length === 0 || token !== sequence) return;
      idleIndex = 0;
      setFrame(idleFrames[idleIndex], 'idle', idleIndex);

      const advance = () => {
        if (!element || token !== sequence) return;
        if (idleIndex >= idleFrames.length - 1) {
          idleIndex = 0;
          setFrame(idleFrames[idleIndex], 'idle', idleIndex);
          timer = setTimeout(advance, idlePauseMs || idleFrameMs);
          return;
        }
        idleIndex += 1;
        setFrame(idleFrames[idleIndex], 'idle', idleIndex);
        timer = setTimeout(advance, idleFrameMs);
      };
      timer = setTimeout(advance, idlePauseMs || idleFrameMs);
    }

    return {
      attach(nextElement) {
        clearTimer();
        cancelPendingChop();
        sequence += 1;
        element = nextElement || null;
        startIdle(sequence);
      },

      playChop(options = {}) {
        if (!element || chopFrames.length === 0) return Promise.resolve(false);
        const shouldResumeIdle = options.resumeIdle !== false;
        clearTimer();
        sequence += 1;
        const token = sequence;

        return new Promise(resolve => {
          pendingChopResolve = resolve;
          let index = 0;
          const advance = () => {
            if (!element || token !== sequence) {
              pendingChopResolve = null;
              resolve(false);
              return;
            }
            setFrame(chopFrames[index], 'chop', index);
            index += 1;
            if (index < chopFrames.length) {
              timer = setTimeout(advance, chopFrameMs);
              return;
            }
            timer = setTimeout(() => {
              if (!element || token !== sequence) {
                pendingChopResolve = null;
                resolve(false);
                return;
              }
              if (shouldResumeIdle) {
                startIdle(token);
              } else {
                setFrame(chopFrames[chopFrames.length - 1], 'chop-hold', chopFrames.length - 1);
                timer = null;
              }
              pendingChopResolve = null;
              resolve(true);
            }, chopFrameMs);
          };
          advance();
        });
      },

      resumeIdle() {
        if (!element || idleFrames.length === 0) return false;
        clearTimer();
        cancelPendingChop();
        sequence += 1;
        startIdle(sequence);
        return true;
      },

      stop() {
        clearTimer();
        cancelPendingChop();
        sequence += 1;
        element = null;
      },
    };
  }

  root.CharacterAnimator = { createFrameAnimator };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { createFrameAnimator };
  }
})(typeof globalThis !== 'undefined' ? globalThis : window);
