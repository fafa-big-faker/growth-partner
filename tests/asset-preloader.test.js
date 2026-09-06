const test = require('node:test');
const assert = require('node:assert/strict');
const { collect } = require('../asset-preloader');

test('asset collection flattens image groups and removes duplicates', () => {
  assert.deepEqual(collect({ a: ['a.png', 'a.png'], b: { one: 'b.webp' }, other: 'notes.txt' }), ['a.png', 'b.webp']);
});
