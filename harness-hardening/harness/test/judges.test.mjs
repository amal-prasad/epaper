// The judges (gates, runners, hooks, test files, spike scorer) must match what Amal last approved.
// If the first test fails: Claude, stop and tell Amal what you changed and why; Amal, read the diff and run `npm run approve`.
import test from 'node:test'
import assert from 'node:assert/strict'
import { verify, appendOnlyProblems, gateChanges, ROOT } from '../judges.mjs'

test('judges match the approved lock (npm run approve)', () => {
  const v = verify(ROOT)
  assert.ok(v.ok, `Judge files changed without Amal's approval:\n  - ${v.problems.join('\n  - ')}\nAmal: read the diff, then run \`npm run approve\` in your own terminal.`)
})

// ---- the checker itself
const base = `import test from 'node:test'\ntest('a', () => {\n  assert.equal(f(1), 2)\n})\n`
test('append-only: adding a new top-level test is fine', () =>
  assert.deepEqual(appendOnlyProblems(base, base + `test('b', () => {\n  assert.ok(g())\n})\n`), []))
test('append-only: inserting a test between top-level statements is fine', () =>
  assert.deepEqual(appendOnlyProblems(base, base.replace("test('a'", "test('new', () => {})\ntest('a'")), []))
test('append-only: changing an assertion is caught', () =>
  assert.equal(appendOnlyProblems(base, base.replace('f(1), 2', 'f(1), f(1)')).length > 0, true))
test('append-only: an early return inside an existing test is caught', () =>
  assert.match(appendOnlyProblems(base, base.replace("() => {\n", "() => {\n  return\n")).join(), /inside an existing block/))
test('append-only: .skip / process.exit / rewiring assert are caught even at top level', () => {
  for (const add of ["test.skip('x', () => {})", 'process.exit(0)', 'assert.equal = () => {}', "test('y', { skip: true }, () => {})"])
    assert.match(appendOnlyProblems(base, base + add + '\n').join(), /disables or rewires/, add)
})
test('append-only: CRLF line endings and blank lines do not count as changes', () =>
  assert.deepEqual(appendOnlyProblems(base, base.replace(/\n/g, '\r\n') + '\r\n\r\n'), []))
test('append-only: a deleted file is caught', () => assert.deepEqual(appendOnlyProblems(base, null), ['file deleted']))

const G = (o = {}) => ({ gates: [{ id: 'g', phase: 0, status: 'active', op: '>=', threshold: 95, metricKey: 'pct', metricFile: 'x.json', ...o }] })
test('gate diff: lowering a >= threshold is LOOSENED, raising it is not', () => {
  assert.equal(gateChanges(G(), G({ threshold: 90 }))[0].loosened, true)
  assert.equal(gateChanges(G(), G({ threshold: 99 }))[0].loosened, false)
})
test('gate diff: raising a <= threshold is LOOSENED', () =>
  assert.equal(gateChanges(G({ op: '<=', threshold: 0 }), G({ op: '<=', threshold: 2 }))[0].loosened, true))
test('gate diff: active -> pending, removed gate, changed metric are LOOSENED', () => {
  assert.equal(gateChanges(G(), G({ status: 'pending' }))[0].loosened, true)
  assert.equal(gateChanges(G(), { gates: [] })[0].loosened, true)
  assert.equal(gateChanges(G(), G({ metricKey: 'pctAll' }))[0].loosened, true)
})
test('gate diff: pending -> active and new gates are not loosening', () => {
  assert.equal(gateChanges(G({ status: 'pending' }), G())[0].loosened, false)
  assert.equal(gateChanges({ gates: [] }, G())[0].loosened, false)
})
