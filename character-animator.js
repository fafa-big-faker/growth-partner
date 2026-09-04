(function initCharacterAnimator(root) {
  function createFrameAnimator(options) {
    const idleFrames = [...(options.idleFrames || [])];
    const chopFrames = [...(options.chopFrames || [])];
    const idleFrameMs = options.idleFrameMs || 200;
    const chopFrameMs = options.chopFrameMs || 90;
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

    function setFrame(frame, mode) {
      if (!element || !frame) return;
      element.src = frame;
      if (element.dataset) element.dataset.animationState = mode;
    }

    function startIdle(token) {
      if (!element || idleFrames.length === 0 || token !== sequence) return;
      idleIndex = 0;
      setFrame(idleFrames[idleIndex], 'idle');

      const advance = () => {
        if (!element || token !== sequence) return;
        idleIndex = (idleIndex + 1) % idleFrames.length;
        setFrame(idleFrames[idleIndex], 'idle');
        timer = setTimeout(advance, idleFrameMs);
      };
      timer = setTimeout(advance, idleFrameMs);
    }

    return {
      attach(nextElement) {
        clearTimer();
        cancelPendingChop();
        sequence += 1;
        element = nextElement || null;
        startIdle(sequence);
      },

      playChop() {
        if (!element || chopFrames.length === 0) return Promise.resolve(false);
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
            setFrame(chopFrames[index], 'chop');
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
              startIdle(token);
              pendingChopResolve = null;
              resolve(true);
            }, chopFrameMs);
          };
          advance();
        });
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
