const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const app = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
const styles = fs.readFileSync(path.join(__dirname, '..', 'styles.css'), 'utf8');

test('forge reveal accelerates configured candidates while waiting for the real result', () => {
  const controller = app.match(/const ForgeReveal = \{[\s\S]*?\n\};/)?.[0] || '';
  assert.match(controller, /FORGE_POOL\.flatMap/);
  assert.match(controller, /160,\s*150,\s*135,\s*120,\s*108,\s*95,\s*83,\s*73,\s*63,\s*55,\s*48,\s*42,\s*38/);
  assert.match(controller, /animateProgress\(elements,\s*88,\s*cycleDuration\)/);
  assert.match(controller, /transition\s*=\s*`width \$\{duration\}ms linear`/);
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
  assert.match(showForge, />返回<\/button>/);
  assert.doesNotMatch(showForge, /继续锻造/);
  assert.doesNotMatch(showForge, /class="btn btn-outline btn-sm forge-close"/);
  assert.equal((showForge.match(/UI\.modal\(/g) || []).length, 1, 'forge should not stack a second result modal');
});

test('forge reveal styling is restrained and has reduced-motion support', () => {
  assert.match(styles, /\.forge-reveal-art\.is-shaking/);
  assert.match(styles, /\.forge-reveal-flash\.is-active/);
  assert.match(styles, /\.forge-reveal-progress-fill/);
  assert.match(styles, /\.forge-reveal-icon[\s\S]*?forge-candidate-in/);
  assert.match(styles, /#forge-ok\[hidden\]/);
  assert.match(styles, /@media \(prefers-reduced-motion:\s*reduce\)[\s\S]*?\.forge-reveal-art/);
});
