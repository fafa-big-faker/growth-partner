(function initInventoryNovelty(root) {
  function create(options = {}) {
    const storage = options.storage || null;
    const keyPrefix = options.keyPrefix || 'growth-partner:inventory-novelty:';
    const memory = new Map();
    let role = 'player';
    let state = null;

    function emptyState() {
      return {
        initialized: false,
        pendingItems: [],
        pendingWeapons: [],
        itemQuantities: {},
        weaponIds: [],
      };
    }

    function normalize(input) {
      const source = input && typeof input === 'object' ? input : {};
      const itemQuantities = {};
      Object.entries(source.itemQuantities || {}).forEach(([itemId, quantity]) => {
        itemQuantities[String(itemId)] = Math.max(0, Number(quantity) || 0);
      });
      return {
        initialized: source.initialized === true,
        pendingItems: [...new Set((source.pendingItems || []).map(String))],
        pendingWeapons: [...new Set((source.pendingWeapons || []).map(String))],
        itemQuantities,
        weaponIds: [...new Set((source.weaponIds || []).map(String))],
      };
    }

    function clone(value) {
      return JSON.parse(JSON.stringify(value));
    }

    function load(nextRole) {
      if (memory.has(nextRole)) return clone(memory.get(nextRole));
      try {
        const raw = storage?.getItem(`${keyPrefix}${nextRole}`);
        if (raw) return normalize(JSON.parse(raw));
      } catch (error) {}
      return emptyState();
    }

    function persist() {
      memory.set(role, clone(state));
      try {
        storage?.setItem(`${keyPrefix}${role}`, JSON.stringify(state));
      } catch (error) {}
    }

    function ensureState() {
      if (!state) state = load(role);
      return state;
    }

    function setRole(nextRole) {
      const normalizedRole = String(nextRole || 'player');
      if (state && normalizedRole === role) return;
      if (state) persist();
      role = normalizedRole;
      state = load(role);
    }

    function sync(inventory = [], weapons = []) {
      ensureState();
      const nextItems = {};
      for (const item of inventory || []) {
        const itemId = String(item?.itemId ?? '');
        if (!itemId) continue;
        nextItems[itemId] = Math.max(0, Number(item.quantity) || 0);
      }
      const nextWeapons = [...new Set((weapons || [])
        .map(weapon => String(weapon?.id ?? ''))
        .filter(Boolean))];

      if (state.initialized) {
        const pendingItems = new Set(state.pendingItems);
        const pendingWeapons = new Set(state.pendingWeapons);
        Object.entries(nextItems).forEach(([itemId, quantity]) => {
          if (quantity > (Number(state.itemQuantities[itemId]) || 0)) pendingItems.add(itemId);
        });
        const previousWeapons = new Set(state.weaponIds);
        nextWeapons.forEach(instanceId => {
          if (!previousWeapons.has(instanceId)) pendingWeapons.add(instanceId);
        });
        state.pendingItems = [...pendingItems];
        state.pendingWeapons = [...pendingWeapons];
      } else {
        state.initialized = true;
      }

      state.itemQuantities = nextItems;
      state.weaponIds = nextWeapons;
      persist();
      return {
        items: [...state.pendingItems],
        weapons: [...state.pendingWeapons],
      };
    }

    function isItemNew(itemId) {
      return ensureState().pendingItems.includes(String(itemId));
    }

    function isWeaponNew(instanceId) {
      return ensureState().pendingWeapons.includes(String(instanceId));
    }

    function clearItem(itemId) {
      ensureState();
      state.pendingItems = state.pendingItems.filter(id => id !== String(itemId));
      persist();
    }

    function clearWeapon(instanceId) {
      ensureState();
      state.pendingWeapons = state.pendingWeapons.filter(id => id !== String(instanceId));
      persist();
    }

    function resetMemory() {
      memory.clear();
      state = load(role);
    }

    return { setRole, sync, isItemNew, isWeaponNew, clearItem, clearWeapon, resetMemory };
  }

  const api = { create };
  root.InventoryNovelty = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
