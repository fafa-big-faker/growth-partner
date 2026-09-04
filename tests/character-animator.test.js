const test = require('node:test');
const assert = require('node:assert/strict');

const { createFrameAnimator } = require('../character-animator');


function trackedImage() {
  const history = [];
  let current = '';
  return {
    dataset: {},
    history,
    get src() { return current; },
    set src(value) {
      current = value;
      history.push(value);
    },
  };
}


test('attach starts idle and chop plays every frame before resuming idle', async () => {
  const animator = createFrameAnimator({
    idleFrames: ['idle-1', 'idle-2'],
    chopFrames: ['chop-1', 'chop-2', 'chop-3'],
    idleFrameMs: 20,
    chopFrameMs: 2,
  });
  const image = trackedImage();

  animator.attach(image);
  assert.equal(image.src, 'idle-1');

  const completed = await animator.playChop();
  assert.equal(completed, true);
  assert.deepEqual(
    image.history.filter(src => src.startsWith('chop-')),
    ['chop-1', 'chop-2', 'chop-3'],
  );
  assert.equal(image.src, 'idle-1');
  animator.stop();
});


test('reattaching cancels work on the old image', async () => {
  const animator = createFrameAnimator({
    idleFrames: ['idle-1', 'idle-2'],
    chopFrames: ['chop-1', 'chop-2'],
    idleFrameMs: 2,
    chopFrameMs: 10,
  });
  const oldImage = trackedImage();
  const newImage = trackedImage();

  animator.attach(oldImage);
  const pendingChop = animator.playChop();
  animator.attach(newImage);
  const oldHistoryLength = oldImage.history.length;

  assert.equal(await pendingChop, false);
  await new Promise(resolve => setTimeout(resolve, 8));
  assert.equal(oldImage.history.length, oldHistoryLength);
  assert.ok(newImage.history.length > 1);
  animator.stop();
});
