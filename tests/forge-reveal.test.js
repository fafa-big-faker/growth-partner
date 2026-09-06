const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const app = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
const styles = fs.readFileSync(path.join(__dirname, '..', 'styles.css'), 'utf8');

test('forge reveal accelerates configured candidates while waiting for the real result', () => {
  const controller = app.match(/const ForgeReveal = \{[\s\S]*?\n\};/)?.[0] || '';
  assert.match(controller, /FORGE_POOL\.flatMap/);
  assert.match(controller, /320,\s*300,\s*270,\s*240,\s*215,\s*190,\s*165,\s*145,\s*125,\s*110,\s*95,\s*82,\s*76/);
  assert.match(controller, /prefers-reduced-motion:\s*reduce/);
  assert.match(controller, /setProgress\(elements,\s*94\)/);
  assert.match(controller, /const result = await resultPromise/);
  assert.match(controller, /if \(!result\)/);
  assert.match(controller, /setProgress\(elements,\s*100\)/);
  assert.match(controller, /result\.itemId/);
});

test('forge modal runs one guarded operation and reveals the result in place', () => {
  const showForge = app.match(/\r?\n  showForge\(\) \{[\s\S]*?\r?\n  },\r?\n\r?\n  \/\/ 十连砍/)?.[0] || '';
  assert.match(showForge, /id="forge-reveal-stage"/);
  assert.match(showForge, /role="progressbar"/);
  assert.match(showForge, /UI\.runLockedAction\('forge'/);
  assert.match(showForge, /ForgeReveal\.run\([\s\S]*?Game\.forge\(\)/);
  assert.match(showForge, /forge-result-actions/);
  assert.equal((showForge.match(/UI\.modal\(/g) || []).length, 1, 'forge should not stack a second result modal');
});

test('forge reveal styling is restrained and has reduced-motion support', () => {
  assert.match(styles, /\.forge-reveal-art\.is-shaking/);
  assert.match(styles, /\.forge-reveal-flash\.is-active/);
  assert.match(styles, /\.forge-reveal-progress-fill/);
  assert.match(styles, /@media \(prefers-reduced-motion:\s*reduce\)[\s\S]*?\.forge-reveal-art/);
});
