(function initGameplayRules(root) {
  function isBonusChop(totalChops, interval = 10) {
    const count = Number(totalChops);
    const cadence = Number(interval);
    return Number.isInteger(count) && count > 0
      && Number.isInteger(cadence) && cadence > 0
      && count % cadence === 0;
  }

  function rollPackItem(pack, random = Math.random()) {
    if (!pack || !Array.isArray(pack.items) || pack.items.length === 0) return null;
    const normalized = Math.min(Math.max(Number(random) || 0, 0), 0.999999999);
    const index = Math.floor(normalized * pack.items.length);
    return {
      itemId: String(pack.items[index]),
      quality: Number(pack.qualityId) || 1,
    };
  }

  const api = { isBonusChop, rollPackItem };
  root.GameplayRules = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
