const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const build = require('../scripts/build_boot_assets.cjs');
const manifest = require('../boot-assets.js');

test('boot manifest matches every current file byte and its derived version', () => {
  assert.match(manifest.version, /^[a-f0-9]{64}$/);
  assert.equal(manifest.version, build.sha256(Buffer.from(JSON.stringify(manifest.assets))));
  assert.equal(new Set(manifest.assets.map(asset => asset.url)).size, manifest.assets.length);
  for (const asset of manifest.assets) {
    const { file, kind } = build.fileForUrl(asset.url);
    const bytes = fs.readFileSync(file);
    assert.ok(asset.bytes > 0 && asset.bytes === bytes.length, `${asset.url}: exact size`);
    assert.equal(asset.sha256, build.sha256(bytes), `${asset.url}: exact content hash`);
    assert.equal(asset.kind, kind);
    assert.ok(['all', 1, 2].includes(asset.density));
  }
  assert.deepEqual(build.generate(), manifest, 'actual URL resolvers and runtime file changes must regenerate boot-assets.js');
});

test('entry background and progress textures download before the rest of the pack', () => {
  const login = build.moduleExports(path.join(build.ROOT, 'login-boot.js'));
  const entry = login.getEntryAssets ? [...login.getEntryAssets()] : build.ENTRY_ASSETS;
  assert.deepEqual(manifest.assets.slice(0, entry.length).map(asset => asset.url), entry);
  assert.equal(manifest.assets[0].url, 'assets/runtime/entry-preparation/background.webp?v=entry-preparation-20260910');
  assert.ok(manifest.assets[0].bytes <= 100 * 1024);
  const rest = manifest.assets.slice(entry.length).map(asset => asset.url);
  assert.deepEqual(rest, [...rest].sort(), 'remaining URLs keep stable lexical order');
});

test('each density includes exactly the live common and login resources plus all nine weapons and audio', () => {
  const login = build.moduleExports(path.join(build.ROOT, 'login-boot.js'));
  const audio = build.moduleExports(path.join(build.ROOT, 'audio-manager.js'));
  for (const density of [1, 2]) {
    const actual = build.resolveGameAssets(density);
    const expected = [...new Set([...actual.common, ...actual.frames,
      ...login.getCriticalAssets(), ...login.getDecorationAssets(),
      ...(login.getEntryAssets ? login.getEntryAssets() : build.ENTRY_ASSETS), ...Object.values(audio.AUDIO_PATHS)])].sort();
    const selected = manifest.assets.filter(asset => asset.density === 'all' || asset.density === density);
    assert.deepEqual(selected.map(asset => asset.url).sort(), expected);
    const trees = selected.filter(asset => asset.url.startsWith('assets/runtime/wish-trees/'));
    assert.equal(trees.length, 10);
    assert.ok(trees.every(asset => asset.url.includes('@2x') === (density === 2)));
  }
  const frames = manifest.assets.filter(asset => /\/character\/(?:idle-axes|axes)\//.test(asset.url));
  assert.equal(frames.length, 90);
  const ids = build.resolveGameAssets(1).weaponIds;
  assert.equal(ids.length, 9);
  for (const id of ids) {
    assert.equal(frames.filter(asset => asset.url.includes(`/idle-axes/${id}/`)).length, 4);
    assert.equal(frames.filter(asset => asset.url.includes(`/axes/${id}/`)).length, 6);
  }
  assert.ok(frames.every(asset => asset.density === 'all'));
  const sounds = manifest.assets.filter(asset => asset.kind === 'audio');
  assert.equal(sounds.length, 13);
  assert.deepEqual(sounds.map(asset => asset.url).sort(), [...Object.values(audio.AUDIO_PATHS)].sort());
  assert.ok(sounds.every(asset => asset.density === 'all'));
});

test('manifest works as a browser global and excludes application code, original atlases and external endpoints', () => {
  const context = vm.createContext({});
  vm.runInContext(fs.readFileSync(path.join(build.ROOT, 'boot-assets.js'), 'utf8'), context);
  assert.deepEqual(JSON.parse(JSON.stringify(context.BootAssetManifest)), manifest);
  const forbidden = ['https://example.com/art.webp', 'assets/images/atlas.png', 'app.js',
    'assets/runtime/../private.png', 'assets/runtime/private.json', 'assets/runtime/a.webp#hidden',
    'assets/runtime/%2e%2e/private.webp', 'assets/runtime/a.webp\\else'];
  for (const url of forbidden) assert.throws(() => build.fileForUrl(url), undefined, url);
  assert.ok(!manifest.assets.some(asset => /\.png(?:\?|$)/.test(asset.url)), 'raw PNG artwork is not downloaded for boot');
});
