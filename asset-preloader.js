(function initAssetPreloader(root) {
  function collect(groups) {
    const urls = [];
    const visit = value => {
      if (typeof value === 'string' && /\.(png|jpe?g|webp|gif)(\?.*)?$/i.test(value)) urls.push(value);
      else if (Array.isArray(value)) value.forEach(visit);
      else if (value && typeof value === 'object') Object.values(value).forEach(visit);
    };
    visit(groups);
    return [...new Set(urls)];
  }

  async function preload(urls, onProgress = () => {}) {
    const unique = [...new Set(urls || [])];
    let loaded = 0;
    const failed = [];
    onProgress({ loaded, total: unique.length, percent: unique.length ? 0 : 100 });
    await Promise.all(unique.map(src => new Promise(resolve => {
      const image = new Image();
      let settled = false;
      const finish = ok => {
        if (settled) return;
        settled = true;
        loaded += 1;
        if (!ok) failed.push(src);
        onProgress({ loaded, total: unique.length, percent: unique.length ? Math.round(loaded / unique.length * 100) : 100, src, ok });
        resolve();
      };
      image.onload = () => finish(true);
      image.onerror = () => finish(false);
      image.src = src;
      if (image.complete && image.naturalWidth > 0) finish(true);
    })));
    return { total: unique.length, failed };
  }

  root.AssetPreloader = { collect, preload };
  if (typeof module !== 'undefined' && module.exports) module.exports = { collect };
})(typeof globalThis !== 'undefined' ? globalThis : window);
