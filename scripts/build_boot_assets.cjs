#!/usr/bin/env node
'use strict';

// Read actual runtime URL resolvers without initializing authentication or Supabase.
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..');
const ENTRY_ASSETS = [
  'assets/runtime/entry-preparation/background.webp?v=entry-preparation-20260910',
  'assets/runtime/ink-controls/exp-track.webp?v=ink-controls-20260909',
  'assets/runtime/ink-controls/exp-fill.webp?v=ink-controls-20260909',
];
const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg']);
const AUDIO_EXTENSIONS = new Set(['.mp3', '.wav', '.ogg', '.m4a', '.aac']);
const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

function moduleExports(file) {
  const context = vm.createContext({ module: { exports: {} }, console,
    setTimeout() { throw new Error('Asset inspection must never schedule application work.'); }, clearTimeout() {} });
  vm.runInContext(fs.readFileSync(file, 'utf8'), context, { filename: file, timeout: 3000 });
  return context.module.exports;
}

function resolveGameAssets(density, root = ROOT) {
  assert.ok(density === 1 || density === 2, 'Inspect density 1 or 2 only');
  const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
  const boundary = app.search(/\n(?:let|const)\s+dbClient\s*=/);
  assert.ok(boundary > 0, 'Cannot find the app resource-definition boundary before database initialization');
  const prefix = app.slice(0, boundary);
  assert.ok(!/\bcreateClient\s*\(|\bconst\s+(?:DB|Auth)\s*=/.test(prefix), 'Database/authentication code must not run during asset generation');
  const preloader = moduleExports(path.join(root, 'asset-preloader.js'));
  const context = vm.createContext({
    console,
    window: { devicePixelRatio: density },
    CharacterAnimator: { createFrameAnimator() { return {}; } },
    AssetPreloader: { collect: preloader.collect },
  });
  vm.runInContext(fs.readFileSync(path.join(root, 'game-config.js'), 'utf8'), context,
    { filename: 'game-config.js', timeout: 3000 });
  vm.runInContext(prefix, context, { filename: 'app-resource-definitions.js', timeout: 3000 });
  const resolved = vm.runInContext(`({
    common: getInitialGameImageAssets(),
    weaponIds: [...AXE_ANIMATION_IDS],
    frames: AXE_ANIMATION_IDS.flatMap(id => [...getAxeIdleFrames(id), ...getAxeChopFrames(id)])
  })`, context, { timeout: 3000 });
  return JSON.parse(JSON.stringify(resolved));
}

function fileForUrl(url, root = ROOT) {
  assert.equal(typeof url, 'string', 'Asset URL must be a string');
  assert.ok(url.startsWith('assets/runtime/') && !url.includes('\\') && !url.includes('#') && !url.includes('%'),
    'Boot assets must use unambiguous local runtime paths');
  const parsed = new URL(url, 'https://boot-assets.invalid/');
  assert.equal(parsed.origin, 'https://boot-assets.invalid');
  assert.equal(parsed.pathname, '/' + url.split('?')[0], 'Asset paths must not contain traversal');
  const file = path.resolve(root, '.' + parsed.pathname);
  const allowed = path.join(root, 'assets', 'runtime') + path.sep;
  assert.ok(file.startsWith(allowed), 'Asset file escapes runtime directory');
  const extension = path.extname(file).toLowerCase();
  assert.ok(IMAGE_EXTENSIONS.has(extension) || AUDIO_EXTENSIONS.has(extension), 'Only image/audio payloads belong in the boot pack');
  return { file, kind: AUDIO_EXTENSIONS.has(extension) ? 'audio' : 'image' };
}

function generate(root = ROOT) {
  const resolutions = [1, 2].map(density => ({ density, ...resolveGameAssets(density, root) }));
  const login = moduleExports(path.join(root, 'login-boot.js'));
  const audio = moduleExports(path.join(root, 'audio-manager.js'));
  const entryAssets = login.getEntryAssets ? login.getEntryAssets() : ENTRY_ASSETS;
  const common = [...login.getCriticalAssets(), ...login.getDecorationAssets(),
    ...entryAssets, ...Object.values(audio.AUDIO_PATHS)];
  const entries = new Map();
  const add = (url, density, phase = 'boot') => {
    const prior = entries.get(url);
    if (prior) {
      if (prior.density !== density) prior.density = 'all';
      if (prior.phase !== phase) prior.phase = 'boot';
      return;
    }
    const { file, kind } = fileForUrl(url, root);
    const bytes = fs.readFileSync(file);
    assert.ok(bytes.length > 0, 'Boot assets must not be empty');
    entries.set(url, { url, bytes: bytes.length, sha256: sha256(bytes), kind, density, phase });
  };
  for (const resolution of resolutions) {
    for (const url of resolution.common) {
      add(url, resolution.density, url.startsWith('assets/runtime/wish-trees/') ? 'deferred' : 'boot');
    }
    for (const url of resolution.frames) add(url, resolution.density, 'deferred');
  }
  for (const url of common) add(url, 'all', 'boot');
  const priority = url => { const index = entryAssets.indexOf(url); return index < 0 ? entryAssets.length : index; };
  const assets = [...entries.values()].sort((left, right) => priority(left.url) - priority(right.url)
    || (left.url < right.url ? -1 : left.url > right.url ? 1 : 0));
  for (const asset of assets) {
    assert.ok(asset.density === 'all' || asset.url.startsWith('assets/runtime/wish-trees/'),
      'Only the selected tree density can differ between devices');
  }
  const version = sha256(Buffer.from(JSON.stringify(assets)));
  return { version, assets };
}

function serialize(manifest) {
  return `/* Generated by scripts/build_boot_assets.cjs. Do not edit by hand. */\n` +
    `(function (root) {\n  'use strict';\n  const manifest = ${JSON.stringify(manifest, null, 2)};\n` +
    `  root.BootAssetManifest = manifest;\n` +
    `  if (typeof module === 'object' && module.exports) module.exports = manifest;\n` +
    `})(typeof globalThis === 'undefined' ? window : globalThis);\n`;
}

function main() {
  const manifest = generate();
  const output = serialize(manifest);
  const target = path.join(ROOT, 'boot-assets.js');
  if (process.argv.includes('--check')) {
    assert.equal(fs.readFileSync(target, 'utf8').replace(/\r\n/g, '\n'), output,
      'boot-assets.js is stale. Run node scripts/build_boot_assets.cjs after changing runtime resources or their URLs.');
  } else fs.writeFileSync(target, output);
  const selected = density => manifest.assets.filter(asset => asset.density === 'all' || asset.density === density);
  console.log(JSON.stringify({ checked: process.argv.includes('--check'), version: manifest.version,
    assets: manifest.assets.length, audio: manifest.assets.filter(asset => asset.kind === 'audio').length,
    frames: manifest.assets.filter(asset => /\/character\/(?:idle-axes|axes)\//.test(asset.url)).length,
    boot: manifest.assets.filter(asset => asset.phase === 'boot').length,
    deferred: manifest.assets.filter(asset => asset.phase === 'deferred').length,
    density1: { files: selected(1).length, bytes: selected(1).reduce((sum, asset) => sum + asset.bytes, 0) },
    density2: { files: selected(2).length, bytes: selected(2).reduce((sum, asset) => sum + asset.bytes, 0) },
  }));
}

module.exports = { ROOT, ENTRY_ASSETS, sha256, moduleExports, resolveGameAssets, fileForUrl, generate, serialize };
if (require.main === module) {
  try { main(); } catch (error) { console.error(error.message); process.exitCode = 1; }
}
