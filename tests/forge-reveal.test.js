const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const app = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
const styles = fs.readFileSync(path.join(__dirname, '..', 'styles.css'), 'utf8');

test('forge reveal accelerates configured candidates while waiting for the real result', () => {
  const controller = app.match(/const ForgeReveal = \{[\s\S]*?\n\};/)?.[0] || '';
  assert.match(controller, /FORGE_POOL\.flatMap/);
  assert.match(controller, /160,\s*150,\s*135,\s*120,\s*108,\s*95,\s*83,\s*73,\s*63,\s*55,\s*48,\s*42,\s*38/);
  assert.match(controller, /Promise\.resolve\(resultPromise\)\.then/);
  assert.match(controller, /settled:\s*false/);
  assert.match(controller, /animateProgress\(elements,\s*98,\s*minimumDuration\)/);
  assert.match(controller, /transition\s*=\s*`width \$\{duration\}ms linear`/);
  assert.match(controller, /prefers-reduced-motion:\s*reduce/);
  assert.match(controller, /while \(!tracked\.settled \|\| Date\.now\(\) < minimumDeadline\)/);
  assert.match(controller, /const fastDelay = 38/);
  assert.match(controller, /showCandidate\(elements,[\s\S]*?fastDelay/);
  assert.match(controller, /setProgress\(elements,\s*98\)/);
  assert.match(controller, /if \(tracked\.error\) throw tracked\.error/);
  assert.match(controller, /if \(!result\)/);
  assert.match(controller, /setProgress\(elements,\s*100\)/);
  assert.match(controller, /result\.itemId/);
});

test('forge reveal samples an inclusive two-to-three-second presentation floor', () => {
  const controller = app.match(/const ForgeReveal = \{[\s\S]*?\n\};/)?.[0] || '';
  const sandbox = {};
  vm.runInNewContext(`${controller}\n;globalThis.__forgeReveal = ForgeReveal;`, sandbox);
  assert.equal(sandbox.__forgeReveal.getMinimumDuration(() => 0), 2000);
  assert.equal(sandbox.__forgeReveal.getMinimumDuration(() => 1), 3000);
  assert.match(controller, /const minimumDuration = this\.getMinimumDuration\(\)/);
  assert.match(controller, /const minimumDeadline = Date\.now\(\) \+ minimumDuration/);
});

test('forge modal runs one guarded operation and reveals the result in place', () => {
  const showForge = app.match(/\r?\n  showForge\(\) \{[\s\S]*?\r?\n  },\r?\n\r?\n  \/\/ 十连砍/)?.[0] || '';
  assert.match(showForge, /id="forge-reveal-stage"/);
  assert.doesNotMatch(showForge, /id="forge-reveal-stage"[^>]*hidden/);
  assert.match(showForge, /role="progressbar"/);
  assert.match(showForge, /class="forge-probability-details"/);
  assert.match(showForge, /<summary>查看概率详情<\/summary>/);
  assert.match(showForge, /class="forge-primary-actions"/);
  assert.match(showForge, /UI\.runLockedAction\('forge'/);
  assert.match(showForge, /ForgeReveal\.run\([\s\S]*?Game\.forge\(\)/);
  assert.match(showForge, /class="forge-material-cost"/);
  assert.match(showForge, /<b[^>]*>\$\{forgeQty\}<\/b><span[^>]*>\/\$\{forgeCost\}<\/span>/);
  assert.match(showForge, /id="forge-ok"[^\n]*>锻造<\/button>/);
  assert.doesNotMatch(showForge, /forge-modal-icon/);
  assert.match(showForge, /btn\.textContent = '再锻造一次'/);
  assert.match(showForge, />立即装备<\/button>/);
  assert.doesNotMatch(showForge, />返回<\/button>/);
  assert.doesNotMatch(showForge, /继续锻造/);
  assert.doesNotMatch(showForge, /class="btn btn-outline btn-sm forge-close"/);
  assert.doesNotMatch(showForge, /footer:/);
  assert.equal((showForge.match(/UI\.modal\(/g) || []).length, 1, 'forge should not stack a second result modal');
});

test('forge reveal styling is restrained and has reduced-motion support', () => {
  assert.match(styles, /\.forge-reveal-art\.is-shaking/);
  assert.match(styles, /\.forge-reveal-flash\.is-active/);
  assert.match(styles, /\.forge-reveal-progress-fill/);
  assert.match(styles, /\.forge-reveal-icon[\s\S]*?forge-candidate-in/);
  assert.match(styles, /\.forge-primary-actions[\s\S]*?justify-content:\s*center/);
  assert.match(styles, /\.forge-probability-details/);
  assert.match(styles, /\.forge-material-cost/);
  assert.match(styles, /\.forge-result-equip/);
  assert.match(styles, /@media \(prefers-reduced-motion:\s*reduce\)[\s\S]*?\.forge-reveal-art/);
});

test('equipping a forge result keeps the draw loop open', () => {
  const equip = app.match(/\r?\n  async _equipFromForge\([\s\S]*?\r?\n  },\r?\n\r?\n  sellItem/)?.[0] || '';
  assert.match(equip, /button\.textContent = '已装备'/);
  assert.doesNotMatch(equip, /modal-overlay'[\s\S]*?remove/);
});
