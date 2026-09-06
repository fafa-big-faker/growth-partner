const test = require('node:test');
const assert = require('node:assert/strict');
const { getStep } = require('../ten-chop-timeline');

test('ten chop accelerates linearly from one to three times speed', () => {
  const first = getStep(0);
  const middle = getStep(4);
  const last = getStep(9);
  assert.equal(first.speed, 1);
  assert.ok(middle.speed > first.speed && middle.speed < last.speed);
  assert.equal(last.speed, 3);
  assert.equal(first.frameMs, 90);
  assert.equal(last.frameMs, 30);
  assert.equal(first.dropMs, 600);
  assert.equal(last.dropMs, 200);
  assert.equal(first.gapMs, 120);
  assert.equal(last.gapMs, 40);
});
