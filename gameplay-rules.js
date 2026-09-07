(function initGameplayRules(root) {
  const TEN_CHOP_UNLOCK_REALM = 2;

  function canUseTenChop(realmLevel) {
    return Number(realmLevel) >= TEN_CHOP_UNLOCK_REALM;
  }

  function isBonusChop(totalChops, interval = 10) {
    const count = Number(totalChops);
    const cadence = Number(interval);
    return Number.isInteger(count) && count > 0
      && Number.isInteger(cadence) && cadence > 0
      && count % cadence === 0;
  }

  function rollPackItem(pack, random = Math.random()) {
    if (!pack) return null;
    const rewards = Array.isArray(pack.rewards) && pack.rewards.length > 0
      ? pack.rewards
      : (Array.isArray(pack.items) ? pack.items.map((itemId, index) => ({
        itemId,
        quantity: Array.isArray(pack.quantities) ? pack.quantities[index] : 1,
      })) : []);
    if (rewards.length === 0) return null;
    const normalized = Math.min(Math.max(Number(random) || 0, 0), 0.999999999);
    const index = Math.floor(normalized * rewards.length);
    const selected = rewards[index];
    const configuredQuantity = Number(selected?.quantity);
    return {
      itemId: String(selected.itemId),
      quantity: Number.isInteger(configuredQuantity) && configuredQuantity > 0
        ? configuredQuantity
        : 1,
      quality: Number(pack.qualityId) || 1,
    };
  }

  const api = { TEN_CHOP_UNLOCK_REALM, canUseTenChop, isBonusChop, rollPackItem };
  root.GameplayRules = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
