const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const boot = require('../scripts/build_boot_assets.cjs');

test('Android staging contains one exact mapping for every current runtime payload', () => {
  const builder = require('../android-app/build-android.cjs');
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'xianlai-bundle-test-'));
  try {
    const result = builder.stageBundledAssets(temporary);
    const manifest = boot.generate();
    assert.equal(result.entries, manifest.assets.length);
    const lines = fs.readFileSync(result.manifestFile, 'utf8').trim().split(/\r?\n/);
    assert.equal(lines.length, manifest.assets.length);
    const mapped = new Map(lines.map(line => {
      const [url, assetPath, mime, bytes, sha256] = line.split('\t');
      return [url, { assetPath, mime, bytes: Number(bytes), sha256 }];
    }));
    for (const asset of manifest.assets) {
      const entry = mapped.get(asset.url);
      assert.ok(entry, asset.url);
      assert.equal(entry.bytes, asset.bytes);
      assert.equal(entry.sha256, asset.sha256);
      assert.match(entry.assetPath, /^xianlai\/assets\/runtime\//);
      const payload = fs.readFileSync(path.join(temporary, ...entry.assetPath.split('/')));
      assert.equal(payload.length, asset.bytes);
      assert.equal(crypto.createHash('sha256').update(payload).digest('hex'), asset.sha256);
    }
  } finally {
    fs.rmSync(temporary, { recursive: true, force: true });
  }
});

test('the Android store only serves exact trusted GitHub Pages asset URLs', () => {
  const source = fs.readFileSync(path.join(ROOT,
    'android-app/app/src/main/java/cn/xianlai/game/BundledAssetStore.java'), 'utf8');
  assert.match(source, /NavigationPolicy\.HOME_URL/);
  assert.match(source, /boolean hasAsset\(String url, long bytes, String sha256\)/);
  assert.match(source, /WebResourceResponse responseFor\(WebResourceRequest request\)/);
  assert.match(source, /request\.getUrl\(\)\.toString\(\)/);
  assert.match(source, /entry\.bytes == bytes && entry\.sha256\.equals\(sha256\)/);
  assert.doesNotMatch(source, /HttpURLConnection|URL\.openConnection|loadUrl/);
  const activity = fs.readFileSync(path.join(ROOT,
    'android-app/app/src/main/java/cn/xianlai/game/MainActivity.java'), 'utf8');
  assert.match(activity, /addJavascriptInterface\(bundledAssets, "XianlaiBundledAssets"\)/);
  assert.match(activity, /shouldInterceptRequest\(WebView view, WebResourceRequest request\)/);
  assert.match(activity, /bundledAssets\.responseFor\(request\)/);
});
