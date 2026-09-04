(function initOperationGuard(root) {
  function createOperationGuard() {
    const activeKeys = new Set();

    return {
      isActive(key) {
        return activeKeys.has(String(key));
      },

      async run(key, task) {
        const normalizedKey = String(key);
        if (activeKeys.has(normalizedKey)) {
          return { started: false, value: false };
        }

        activeKeys.add(normalizedKey);
        try {
          return { started: true, value: await task() };
        } finally {
          activeKeys.delete(normalizedKey);
        }
      },
    };
  }

  root.OperationGuard = createOperationGuard();
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { createOperationGuard };
  }
})(typeof globalThis !== 'undefined' ? globalThis : window);
