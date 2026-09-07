(function initPlayerDataCache(root) {
  function createResourceCache(options = {}) {
    const ttlMs = Math.max(0, Number(options.ttlMs) || 0);
    const now = typeof options.now === 'function' ? options.now : Date.now;
    let value = null;
    let hasValue = false;
    let loadedAt = Number.NEGATIVE_INFINITY;
    let pending = null;
    let generation = 0;

    function commit(next) {
      value = next;
      hasValue = true;
      loadedAt = now();
      return value;
    }

    function peek() {
      return hasValue ? value : null;
    }

    function isFresh() {
      return hasValue && now() - loadedAt <= ttlMs;
    }

    function get(loader, getOptions = {}) {
      if (getOptions.force !== true && isFresh()) return Promise.resolve(value);
      if (pending) return pending;

      const requestGeneration = generation;
      const request = Promise.resolve()
        .then(loader)
        .then(next => {
          if (requestGeneration === generation) commit(next);
          return next;
        })
        .finally(() => {
          if (pending === request) pending = null;
        });
      pending = request;
      return request;
    }

    function set(next) {
      generation += 1;
      return commit(next);
    }

    function update(updater) {
      if (!hasValue || typeof updater !== 'function') return null;
      return set(updater(value));
    }

    function invalidate() {
      loadedAt = Number.NEGATIVE_INFINITY;
    }

    function clear() {
      generation += 1;
      value = null;
      hasValue = false;
      loadedAt = Number.NEGATIVE_INFINITY;
      pending = null;
    }

    return { peek, isFresh, get, set, update, invalidate, clear };
  }

  const api = { createResourceCache };
  root.PlayerDataCache = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
