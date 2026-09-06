(function initTenChopTimeline(root) {
  function getStep(index, count = 10, minSpeed = 1, maxSpeed = 3, baseFrameMs = 90, baseDropMs = 600) {
    const safeCount = Math.max(1, Number(count) || 1);
    const position = Math.min(Math.max(Number(index) || 0, 0), safeCount - 1);
    const progress = safeCount === 1 ? 1 : position / (safeCount - 1);
    const speed = minSpeed + (maxSpeed - minSpeed) * progress;
    return {
      speed,
      frameMs: Math.round(baseFrameMs / speed),
      dropMs: Math.round(baseDropMs / speed),
    };
  }

  root.TenChopTimeline = { getStep };
  if (typeof module !== 'undefined' && module.exports) module.exports = { getStep };
})(typeof globalThis !== 'undefined' ? globalThis : window);
