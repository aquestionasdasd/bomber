const assert = require('node:assert/strict');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
// Mutate saved source only in memory. Each mutation must be caught by behavior.
for (const [fault, group] of [
  ['height-rewind', 'TRC normal jumps'],
  ['repeat-jump', 'one stale'],
  ['vertical-velocity', 'second real jump'],
  ['early-stair-rejection', 'jumping beside'],
]) {
  const result = spawnSync(process.execPath, [path.join(__dirname, 'tests-trc-reconciliation.cjs')], {
    env: { ...process.env, TRC_SYNC_FAULT: fault, TRC_SYNC_GROUP: group, TRC_SYNC_REPORT: '' },
    encoding: 'utf8', timeout: 120000, maxBuffer: 1024 * 1024,
  });
  assert.equal(result.error, undefined, fault);
  assert.equal(result.status, 1, `${fault} was not detected\n${result.stdout}\n${result.stderr}`);
  assert.match(result.stderr, /AssertionError/, `${fault} must fail a behavioral assertion`);
  console.log('PASS: detects memory fault ' + fault);
}
console.log('PASS: 4 TRC reconciliation memory faults; no disk mutation or audio');
