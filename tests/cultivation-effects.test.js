const test = require('node:test');
const assert = require('node:assert/strict');

const { createCultivationEffects } = require('../cultivation-effects');


function fakeScene() {
  const children = [];
  return {
    children,
    appendChild(node) {
      children.push(node);
      node.isConnected = true;
      node.remove = () => {
        node.isConnected = false;
        const index = children.indexOf(node);
        if (index >= 0) children.splice(index, 1);
      };
    },
    getBoundingClientRect() {
      return { left: 10, top: 20, width: 300, height: 200 };
    },
  };
}


test('hit effects create bounded particles and scheduled cleanup removes them', () => {
  const scheduled = [];
  const document = {
    createElement() {
      const properties = {};
      return {
        dataset: {},
        style: {
          properties,
          setProperty(name, value) { properties[name] = value; },
        },
      };
    },
  };
  const effects = createCultivationEffects({
    document,
    random: () => 0.5,
    schedule: callback => scheduled.push(callback),
  });
  const scene = fakeScene();
  const tree = {
    getBoundingClientRect() {
      return { left: 190, top: 60, width: 80, height: 100 };
    },
  };

  const count = effects.playHit({ scene, tree, intensity: 1 });

  assert.equal(count, 7);
  assert.equal(scene.children.length, 7);
  assert.equal(scene.children.filter(node => node.className.includes('cult-effect-leaf')).length, 5);
  assert.equal(scene.children.filter(node => node.className.includes('cult-effect-spark')).length, 2);
  assert.ok(scene.children.every(node => node.style.properties['--effect-x']));

  scheduled.forEach(callback => callback());
  assert.equal(scene.children.length, 0);
  effects.clear();
});
