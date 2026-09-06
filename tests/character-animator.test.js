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


test('chop can hold its final frame until idle is explicitly resumed', async () => {
  const animator = createFrameAnimator({
    idleFrames: ['idle-1', 'idle-2'],
    chopFrames: ['chop-1', 'chop-2', 'chop-3'],
    idleFrameMs: 20,
    chopFrameMs: 2,
  });
  const image = trackedImage();

  animator.attach(image);
  const completed = await animator.playChop({ resumeIdle: false });

  assert.equal(completed, true);
  assert.equal(image.src, 'chop-3');
  assert.equal(image.dataset.animationState, 'chop-hold');

  assert.equal(animator.resumeIdle(), true);
  assert.equal(image.src, 'idle-1');
  assert.equal(image.dataset.animationState, 'idle');
  animator.stop();
});


test('idle motion pauses on its neutral frame and reports every frame', async () => {
  const reports = [];
  const animator = createFrameAnimator({
    idleFrames: ['idle-1', 'idle-2'],
    chopFrames: ['chop-1'],
    idleFrameMs: 2,
    idlePauseMs: 12,
    onFrame: report => reports.push(`${report.state}:${report.index}`),
  });
  const image = trackedImage();

  animator.attach(image);
  await new Promise(resolve => setTimeout(resolve, 5));
  assert.deepEqual(reports, ['idle:0']);

  await new Promise(resolve => setTimeout(resolve, 12));
  assert.ok(reports.includes('idle:1'));
  animator.stop();
});

test('frames can be replaced for the currently equipped weapon', async () => {
  const animator = createFrameAnimator({
    idleFrames: ['old-idle'],
    chopFrames: ['old-chop'],
    chopFrameMs: 20,
  });
  const image = trackedImage();
  animator.attach(image);
  animator.setFrames({ idleFrames: ['axe-idle'], chopFrames: ['axe-1', 'axe-2'] });

  assert.equal(image.src, 'axe-idle');
  assert.equal(await animator.playChop({ frameMs: 2, resumeIdle: false }), true);
  assert.deepEqual(image.history.filter(src => src.startsWith('axe-')), ['axe-idle', 'axe-1', 'axe-2', 'axe-2']);
  animator.stop();
});

test('equipped weapon can replace the complete four-frame idle loop', async () => {
  const animator = createFrameAnimator({
    idleFrames: ['old-idle'],
    chopFrames: ['old-chop'],
    idleFrameMs: 2,
    idlePauseMs: 4,
  });
  const image = trackedImage();
  animator.attach(image);
  animator.setFrames({
    idleFrames: ['idle-axe-1', 'idle-axe-2', 'idle-axe-3', 'idle-axe-4'],
    chopFrames: ['chop-axe-1'],
  });

  try {
    assert.equal(image.src, 'idle-axe-1');
    await new Promise(resolve => setTimeout(resolve, 80));
    assert.ok(image.history.includes('idle-axe-2'));
    assert.ok(image.history.includes('idle-axe-3'));
    assert.ok(image.history.includes('idle-axe-4'));
  } finally {
    animator.stop();
  }
});
