# Forge And Login Readability Implementation Plan

> Use executing-plans with independent workers. The requested layout and delegated timing decision are approved in the user's request; do not ask for repeat confirmation. Use project release process in place of unavailable finishing/worktree skills.

**Goal:** Keep forging ergonomic, let the login entrance be noticed, and remove rejected heading blocks.

**Architecture:** Keep ForgeReveal's transaction/timeline and LoginArt's lifecycle; separate the fixed result action from the swappable image. Make scoped CSS/metadata corrections and deliver art prompts without making paid image calls.

**Tech Stack:** Vanilla JS/CSS, existing bitmap resources, Node/Pillow and mocked Playwright tests without screenshots.

## Constraints

No data/config/Supabase changes, no changes to weapon eligibility rules, no resetting user changes, no screenshot acceptance. Source `supabase/` remains untouched. Artwork not yet supplied stays a documented next input, not a generated approximation.

## 1. Forge Worker

Own `app.js` forge UI only, relevant forge styles in `styles.css`, `tests/forge-reveal.test.js`, optional new `tests/forge-layout.browser-check.cjs`.

- [ ] Add regression tests for a fixed action slot inside a stable frame, empty during rolling; eligibility uses `getMinRealmForAxeQuality` and produces either button or red text, never both.
- [ ] Split frame/image/action; keep `elements.art` pointed to the swappable image node so candidate `innerHTML` does not erase the action. Reset slot at the next forge and clear after failure.
- [ ] Keep the primary repeated-forge control from moving on result/equip eligibility changes; preserve secondary weapon details without forcing them above primary controls. Keep material costs and guard behavior.
- [ ] Test instant mocked results eligible/ineligible, repeated draw, equip and title wrapping in desktop/mobile geometry; verify no real database writes.

```js
assert.match(showForge, /id="forge-result-action"/);
assert.doesNotMatch(showForge, /renderAxeRealmRequirement/);
```

## 2. Login Worker

Own `login-art.js`, `tests/login-art.test.js` only. No app/index or shared browser checker edits.

- [ ] Test entrance starts only when backdrop+Logo ready and 500ms visible settling elapsed; image failure must not hide Logo forever.
- [ ] Introduce cancellable settling scheduling separate from form/auth; pause or restart settling when hidden, clear timers/callbacks on destroy. Preserve 1500ms entrance, 10px/6400ms float, optional texture loading and real progress.
- [ ] Test reduced motion, delayed resource load, failure, hide/show and destroy before settling; run login-related tests.

## 3. Main Integration

Own `ink-pages.css`, `index.html`, heading/metadata tests and existing shared browser checks, maintenance docs and art prompt file.

- [ ] Remove the specifically rejected title/section-label/shop-title backgrounds and their added padding, preserving explicit surface under actual long-reading sections and V5 paper item frames. Add assertions for transparent heading backing.
- [ ] Set `<title>仙来</title>` and application-name metadata; leave URL/domain settings alone. Update changed script/style versions consistently to `forge-login-polish-20260908`.
- [ ] Write two prompts with stable layout dimensions, genuine alpha/safe gutters and no baked UI text. Do not change quality markers or replace login button with invented art while waiting for user assets.
- [ ] Run all Node/image/syntax checks plus four page/login and five mobile/scene checks; review staged scope/secrets. Document delay/art/heading rules.

Release gate: scoped commit, push origin/main, successful Pages job and byte-level published asset comparison. Art-generation proposals are delivered separately from implemented corrections.
