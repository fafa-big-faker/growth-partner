(function initInventoryOrder(root) {
  'use strict';

  const PREFIX = 'growth-partner:inventory-order:';
  const numeric = value => Number.isFinite(Number(value)) ? Number(value) : Number.MAX_SAFE_INTEGER;

  function sortItems(items, definitions) {
    return [...items].sort((a, b) =>
      numeric(definitions[a.itemId]?.type) - numeric(definitions[b.itemId]?.type)
      || numeric(a.itemId) - numeric(b.itemId)
      || String(a.itemId).localeCompare(String(b.itemId)));
  }

  function createStore({ storage, accountId = 'player' } = {}) {
    const key = PREFIX + String(accountId);
    let ids = [];
    try {
      const saved = JSON.parse(storage?.getItem(key) || 'null');
      if (Array.isArray(saved)) ids = [...new Set(saved.filter(id => typeof id === 'string' && /^\d+$/.test(id)))];
    } catch (_) {}

    function persist(next) {
      if (ids.length === next.length && ids.every((id, i) => id === next[i])) return;
      ids = next;
      try { storage?.setItem(key, JSON.stringify(ids)); } catch (_) {}
    }

    function order(items) {
      if (!ids.length) return [...items];
      const present = new Set(items.map(item => String(item.itemId)));
      const next = ids.filter(id => present.has(id));
      const known = new Set(next);
      for (const item of items) {
        const id = String(item.itemId);
        if (!known.has(id)) { next.push(id); known.add(id); }
      }
      persist(next);
      const positions = new Map(ids.map((id, index) => [id, index]));
      return [...items].sort((a, b) => positions.get(String(a.itemId)) - positions.get(String(b.itemId)));
    }

    function arrange(items, definitions) {
      const result = sortItems(items, definitions);
      persist(result.map(item => String(item.itemId)));
      return result;
    }

    return { order, arrange };
  }

  const api = { sortItems, createStore };
  root.InventoryOrder = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis === 'undefined' ? window : globalThis);
