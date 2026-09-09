const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const app = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
const styles = fs.readFileSync(path.join(__dirname, '..', 'styles.css'), 'utf8');

test('forge reveal uses a network-independent 60/40 presentation timeline', () => {
  const controller = app.match(/const ForgeReveal = \{[\s\S]*?\n\};/)?.[0] || '';
  assert.match(controller, /FORGE_POOL\.flatMap/);
  assert.match(controller, /Promise\.resolve\(resultPromise\)\.then/);
  assert.match(controller, /settled:\s*false/);
  assert.match(controller, /requestAnimationFrame/);
  assert.match(controller, /prefers-reduced-motion:\s*reduce/);
  assert.match(controller, /while \(elapsed < minimumDuration \|\| !tracked\.settled\)/);
  assert.match(controller, /timeline\.candidateDelay/);
  assert.match(controller, /timeline\.isHolding/);
  assert.doesNotMatch(controller, /animateProgress/);
  assert.doesNotMatch(controller, /transition\s*=\s*`width \$\{duration\}ms linear`/);
  assert.match(controller, /if \(tracked\.error\) throw tracked\.error/);
  assert.match(controller, /if \(!result\)/);
  assert.match(controller, /setProgress\(elements,\s*100\)/);
  assert.match(controller, /result\.itemId/);
});

test('forge timeline reaches 98 percent after 60 percent and then keeps spinning fast', () => {
  const controller = app.match(/const ForgeReveal = \{[\s\S]*?\n\};/)?.[0] || '';
  const sandbox = {};
  vm.runInNewContext(`${controller}\n;globalThis.__forgeReveal = ForgeReveal;`, sandbox);
  const forgeReveal = sandbox.__forgeReveal;

  assert.deepEqual(
    { ...forgeReveal.getTimelineState(0, 3000) },
    { progress: 0, candidateDelay: 120, isHolding: false },
  );
  const halfway = forgeReveal.getTimelineState(900, 3000);
  assert.equal(halfway.progress, 49);
  assert.equal(halfway.candidateDelay, 79);
  assert.equal(halfway.isHolding, false);
  assert.deepEqual(
    { ...forgeReveal.getTimelineState(1800, 3000) },
    { progress: 98, candidateDelay: 38, isHolding: true },
  );
  assert.deepEqual(
    { ...forgeReveal.getTimelineState(3600, 3000) },
    { progress: 98, candidateDelay: 38, isHolding: true },
  );
  assert.match(controller, /safeProgress\.toFixed\(2\)/);
});

test('an instant backend result cannot skip the forge presentation timeline', async () => {
  const controller = app.match(/const ForgeReveal = \{[\s\S]*?\n\};/)?.[0] || '';
  let clock = 0;
  const progressWrites = [];
  const candidateWrites = [];
  const math = Object.create(Math);
  math.random = () => 0;
  const style = {
    transition: '',
    set width(value) {
      progressWrites.push({ at: clock, value: parseFloat(value) });
    },
    setProperty() {},
  };
  const sandbox = {
    Date: { now: () => clock },
    Math: math,
    Promise,
    FORGE_POOL: [{ items: ['51001', '51002'] }],
    ITEMS: {
      '51001': { id: '51001', name: '甲斧', quality: 1, icon: '' },
      '51002': { id: '51002', name: '乙斧', quality: 2, icon: '' },
    },
    QUALITY: { 1: { color: '#999' }, 2: { color: '#49d' } },
    renderItemIcon: () => '<img>',
    window: { matchMedia: () => ({ matches: false }) },
    requestAnimationFrame: callback => {
      clock += 100;
      callback(clock);
    },
    setTimeout: callback => callback(),
  };
  vm.runInNewContext(`${controller}\n;globalThis.__forgeReveal = ForgeReveal;`, sandbox);
  const classList = { add() {}, remove() {}, toggle() {} };
  const elements = {
    progress: { setAttribute() {} },
    progressFill: { style },
    art: { style, classList, set innerHTML(value) { candidateWrites.push({ at: clock, value }); } },
    name: { style: {}, textContent: '' },
    status: { textContent: '' },
    flash: { classList },
  };
  const result = { itemId: '51001', item: sandbox.ITEMS['51001'] };

  await sandbox.__forgeReveal.run(elements, Promise.resolve(result));

  const firstNinetyEight = progressWrites.find(write => write.value >= 98);
  assert.ok(progressWrites.length >= 20, 'progress should be updated across animation frames');
  assert.ok(firstNinetyEight.at >= 1200, '98% must not be reached before 60% of two seconds');
  assert.ok(progressWrites.some(write => write.at >= 1200 && write.at < 2000 && write.value === 98));
  assert.ok(candidateWrites.some(write => write.at >= 1200), 'candidates keep spinning during the hold phase');
  assert.equal(progressWrites.at(-1).value, 100);
  assert.ok(clock >= 2000, 'instant results still honor the sampled presentation duration');
});

test('forge reveal samples an inclusive two-to-three-second presentation floor', () => {
  const controller = app.match(/const ForgeReveal = \{[\s\S]*?\n\};/)?.[0] || '';
  const sandbox = {};
  vm.runInNewContext(`${controller}\n;globalThis.__forgeReveal = ForgeReveal;`, sandbox);
  assert.equal(sandbox.__forgeReveal.getMinimumDuration(() => 0), 2000);
  assert.equal(sandbox.__forgeReveal.getMinimumDuration(() => 1), 3000);
  assert.match(controller, /const minimumDuration = this\.getMinimumDuration\(\)/);
  assert.match(controller, /const startedAt = Date\.now\(\)/);
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

test('forge frame keeps its action slot outside the swapping art and before the repeated draw control', () => {
  const showForge = app.match(/\r?\n  showForge\(\) \{[\s\S]*?\r?\n  },\r?\n\r?\n  \/\/ 十连砍/)?.[0] || '';
  assert.match(showForge, /class="forge-reveal-frame"[\s\S]*?id="forge-reveal-art"[\s\S]*?<\/div>\s*<div id="forge-result-action"/);
  assert.match(showForge, /art:\s*overlay\.querySelector\('#forge-reveal-art'\)/);
  assert.match(showForge, /const resultAction = overlay\.querySelector\('#forge-result-action'\)/);
  assert.match(showForge, /resultAction\.innerHTML = ''/);
  assert.ok(showForge.indexOf('id="forge-result-action"') < showForge.indexOf('id="forge-ok"'));
  assert.ok(showForge.indexOf('id="forge-result-detail"') < showForge.indexOf('id="forge-ok"'));
  assert.ok(showForge.indexOf('class="forge-probability-details"') > showForge.indexOf('id="forge-ok"'));
  assert.match(showForge, /overlay\.classList\.add\('forge-modal-overlay'\)/);
});

test('forge result replaces progress with prominent skills without appending another panel', () => {
  const showForge = app.match(/\r?\n  showForge\(\) \{[\s\S]*?\r?\n  },\r?\n\r?\n  \/\/ 十连砍/)?.[0] || '';
  assert.match(showForge, /class="forge-reveal-information"[\s\S]*class="forge-reveal-running"[\s\S]*id="forge-result-detail"/);
  assert.match(showForge, /暂无斧技/);
  assert.match(showForge, /escapeHtml\(result\.item\.desc/);
  assert.match(styles, /\[data-state="result"\] \.forge-reveal-running\s*\{\s*display:\s*none/);
  assert.match(styles, /\.forge-reveal-information\s*\{[^}]*height:\s*160px/s);
  assert.match(styles, /\.forge-modal-content\s*\{[^}]*overflow-y:\s*auto/s);
});

test('forge eligibility renders an equip action or configured red requirement, never redundant copy', () => {
  const showForge = app.match(/\r?\n  showForge\(\) \{[\s\S]*?\r?\n  },\r?\n\r?\n  \/\/ 十连砍/)?.[0] || '';
  assert.doesNotMatch(showForge, /renderAxeRealmRequirement/);
  assert.match(showForge, /getMinRealmForAxeQuality\(result\.quality\)/);
  assert.match(showForge, /resultAction\.innerHTML = canEquip \?/);
  assert.match(showForge, /forge-result-equip[\s\S]*?>立即装备<\/button>/);
  assert.match(showForge, /forge-result-locked[\s\S]*?及以上可装备/);
  assert.match(styles, /\.forge-result-action\s*\{[^}]*height:\s*44px/);
  assert.match(styles, /\.forge-result-locked\s*\{[^}]*color:\s*#9d3836/);
  assert.match(styles, /\.modal-overlay\.forge-modal-overlay\s*\{[^}]*align-items:\s*flex-start/);
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
