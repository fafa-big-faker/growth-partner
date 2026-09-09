const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createController } = require('../web-interactions');

function fixture() {
  const listeners = new Map();
  const document = {
    addEventListener(name, fn) { if (!listeners.has(name)) listeners.set(name, new Set()); listeners.get(name).add(fn); },
    removeEventListener(name, fn) { listeners.get(name)?.delete(fn); },
  };
  const controller = createController({ document });
  function target({ inside = true, native = false, editable = false, contentEditable = null } = {}) {
    return {
      isContentEditable: editable,
      closest(selector) {
        if (selector.startsWith('#login-screen')) return inside ? this : null;
        if (selector.startsWith('input,')) return native ? this : null;
        if (selector === '[contenteditable]' && contentEditable !== null) return { getAttribute: () => contentEditable };
        return null;
      },
    };
  }
  function dispatch(name, node = target()) {
    const event = { target: node, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; } };
    for (const fn of listeners.get(name) || []) fn(event);
    return event.defaultPrevented;
  }
  controller.init();
  return { controller, listeners, target, dispatch };
}

test('dynamic game surfaces reject native menus, selection and drag without blocking ordinary actions', () => {
  const f = fixture();
  assert.deepEqual([...f.listeners.keys()].sort(), ['contextmenu', 'dragstart', 'selectstart']);
  for (const name of f.listeners.keys()) {
    assert.equal(f.dispatch(name), true);
    assert.equal(f.dispatch(name, { nodeType: 3, parentElement: f.target() }), true);
    assert.equal(f.dispatch(name, f.target({ inside: false })), false);
  }
  for (const name of ['click', 'submit', 'change', 'keydown', 'pointerdown', 'touchstart', 'touchmove', 'wheel']) {
    assert.equal(f.dispatch(name), false, name);
  }
});

test('forms, editable descendants and explicit native exceptions retain editing and clipboard menus', () => {
  const f = fixture();
  for (const name of f.listeners.keys()) {
    for (const options of [{ native: true }, { editable: true }, { contentEditable: '' }, { contentEditable: 'true' }, { contentEditable: 'plaintext-only' }]) {
      assert.equal(f.dispatch(name, f.target(options)), false);
    }
    assert.equal(f.dispatch(name, f.target({ contentEditable: 'false' })), true);
  }
});

test('initialization is idempotent and destroy releases every native-event guard', () => {
  const f = fixture();
  f.controller.init();
  assert.equal([...f.listeners.values()].reduce((count, values) => count + values.size, 0), 3);
  f.controller.destroy();
  f.controller.destroy();
  assert.equal(f.dispatch('contextmenu'), false);
  assert.equal([...f.listeners.values()].every(values => values.size === 0), true);
  f.controller.init();
  assert.equal(f.dispatch('contextmenu'), true);
});

test('surface styles preserve native editing, scrolling and zoom and entry loads the module', () => {
  const root = path.join(__dirname, '..');
  const css = fs.readFileSync(path.join(root, 'web-interactions.css'), 'utf8');
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  assert.match(css, /-webkit-touch-callout:\s*none/);
  assert.match(css, /-webkit-user-drag:\s*none/);
  assert.match(css, /-webkit-touch-callout:\s*default/);
  assert.match(css, /user-select:\s*text/);
  assert.match(css, /touch-action:\s*manipulation/);
  assert.doesNotMatch(css, /touch-action:\s*none|pointer-events:\s*none/);
  assert.doesNotMatch(html, /user-scalable\s*=\s*no|maximum-scale\s*=\s*1/);
  assert.match(html, /web-interactions\.css\?v=android-entry-20260909/);
  assert.match(html, /web-interactions\.js\?v=android-entry-20260909/);
});
