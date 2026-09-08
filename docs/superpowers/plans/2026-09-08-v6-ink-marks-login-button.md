# V6 Ink Marks And Login Button Implementation Plan

> Execute the approved design with executing-plans and independent workers. Unavailable worktree/finishing skills are replaced by the existing project release workflow; the user has authorized direct implementation and release.

**Goal:** Import the supplied V6 artwork without changing gameplay or account data.

**Architecture:** Extend existing deterministic import/build scripts and current CSS selectors. Separate the login button image layers so hover affects lettering only; preserve the real submit element and auth lifecycle.

**Tech Stack:** Vanilla JS/CSS, Pillow PNG/WebP processing, Node tests and mocked Playwright checks without screenshots.

## Global Constraints

Keep original atlases and all unrelated work. No image generation, configuration sync, database or account writes. Runtime URLs use `xianlai-v6-20260908`. No browser visual acceptance. Report a step that makes no progress for ten minutes.

## 1. Asset Worker

Own `scripts/import_xianlai_v6_art.py`, V6 branch in `scripts/build_runtime_images.py`, V6 assets/manifests, `tests/xianlai-v6-assets.test.py`.

- [ ] Add source/crop tests before import. Assert seven RGBA outputs, transparent padded edges, nonempty mark cells, no sixth mark, 1536x1024 input dimensions and source hashes.
- [ ] Measure alpha>=5 actual outlines, preserve complete brush tips and lettering, add padding, write source manifest. Do not infer transparency from visible RGB previews.
- [ ] Add `build_v6_assets()` and `--v6-only`; quality limit 48x112, brush 960x256, lettering 768x256, retain aspect ratio. Keep full build aware of V6, no unrelated rebuild.
- [ ] Run importer, V6-only build and image tests. Confirm runtime totals stay under 180KiB and compare cropped bitmap against source. Report measured output dimensions to UI workers.

```python
assert len(manifest['quality']) == 5
assert set(manifest['ui']) == {'login-brush', 'login-lettering'}
assert image.getchannel('A').getextrema()[0] == 0
```

## 2. Login Worker

Own `login-art.css`, optional bounded `login-art.js` changes and focused login tests. Main owns index markup.

- [ ] Style `.login-submit-brush` and `.login-submit-lettering` as separately contained images inside existing button; main adds these selectors and `.login-submit-fallback` text. Use CSS sizing to preserve current button space and all glyphs.
- [ ] Replace the old border-image and whole-button hover filter. Only lettering gets restrained pale glow on hover/focus, press scales to .98; reduced motion remains static, loading disables feedback. Remove obsolete ellipse look without changing auth or logo motion.
- [ ] Add failure-safe image readiness: retain readable fallback if either image fails. Do not block native form or wait for these assets in auth. Main preloads both exact URLs in head.
- [ ] Test hover/focus/pressed/disabled/reduced states, delayed/failing images and auth-error recovery; run focused tests. Do not modify shared browser checker while main owns it.

```js
assert.match(css, /login-submit-lettering/);
assert.match(html, /type="submit"/);
```

## 3. Main Integration And Release

Own `index.html`, quality region of `xianlai-v4.css`, app preload list, integration tests, shared browser checks and maintenance docs.

- [ ] Replace quality pseudo-element backing with five actual URLs and 12x26px contain geometry, preserving pointer-events:none and empty-slot behavior; add all five to preload.
- [ ] Add native submit image layers, accessible fallback, two head image preloads; version changed files coherently. Do not change page title or logo artwork.
- [ ] Check desktop and body-mounted drawer mapping, image decode, stable slots/badges/button and real login interactions under local mocks. Keep screenshots off.
- [ ] Run all Node/image/syntax tests and diff/secret review, document measured asset pipeline and new UI rules. Stage explicit paths only.
- [ ] Commit, push, verify successful Pages deployment and published versioned file bytes, report completed result and release URL.
