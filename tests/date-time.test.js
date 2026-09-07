const test = require('node:test');
const assert = require('node:assert/strict');

const {
  parseDatabaseTimestamp,
  formatShanghaiDate,
  formatShanghaiDateTime,
} = require('../date-time');

test('timezone-less Supabase timestamps are interpreted as UTC', () => {
  const parsed = parseDatabaseTimestamp('2026-09-07T01:22:23.781443');
  assert.equal(parsed.toISOString(), '2026-09-07T01:22:23.781Z');
  assert.equal(formatShanghaiDateTime('2026-09-07T01:22:23.781443'), '2026/9/7 09:22:23');
});

test('explicit timezone timestamps keep their represented instant', () => {
  assert.equal(
    formatShanghaiDateTime('2026-09-07T09:22:23+08:00'),
    '2026/9/7 09:22:23',
  );
  assert.equal(formatShanghaiDate('2026-09-06T18:30:00Z'), '2026/9/7');
});

test('invalid and empty timestamps render as empty text', () => {
  assert.equal(parseDatabaseTimestamp('not-a-date'), null);
  assert.equal(formatShanghaiDateTime(null), '');
  assert.equal(formatShanghaiDate(''), '');
});
