(function initTaskRewards(root) {
  function append(entries, itemId, quantity, itemDefinitions) {
    const id = String(itemId ?? '').trim();
    const count = Number(quantity);
    const definition = itemDefinitions?.[id];
    if (!id || !definition || !Number.isInteger(count) || count <= 0) return;
    entries.push({
      itemId: id,
      quantity: count,
      name: definition.name || `道具${id}`,
      icon: definition.icon || '',
    });
  }

  function getEntries(source, itemDefinitions = {}) {
    const entries = [];
    append(entries, '1', Number(source?.rewardChopping), itemDefinitions);
    for (const reward of source?.rewardItems || []) {
      append(entries, reward?.item_id, Number(reward?.quantity), itemDefinitions);
    }
    return entries;
  }

  function formatText(entries) {
    if (!Array.isArray(entries) || entries.length === 0) return '无额外奖励';
    return entries.map(entry => `${entry.name} ×${entry.quantity}`).join('、');
  }

  const api = { getEntries, formatText };
  root.TaskRewards = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
