// Tests of the test helpers. If these pass, the helpers really do catch lost text, overlaps and bad undo.
import test from 'node:test'
import assert from 'node:assert/strict'
import { assertConserved, assertInsideFrames, assertClearOfObstacles, assertFits, assertReadingOrder, assertDeterministic } from './helpers/invariants.js'
import { fuzzUndo, int } from './helpers/fuzz.js'
import { fakeWidth } from './helpers/fake-canvas.js'

const frames = [{ id: 'a', x: 0, y: 0, w: 100, h: 42 }, { id: 'b', x: 120, y: 0, w: 100, h: 42 }]
const good = { lines: [
  { frameId: 'a', x: 0, y: 0, w: 100, text: 'मध्य प्रदेश ' }, { frameId: 'a', x: 0, y: 21, w: 100, text: 'में सरकारी ' },
  { frameId: 'b', x: 120, y: 0, w: 100, text: 'नौकरी की' }], remainder: ' तैयारी' }
const story = 'मध्य प्रदेश में सरकारी नौकरी की तैयारी'

test('conservation passes on a correct result', () => assertConserved(story, good))
test('conservation catches a dropped word', () => assert.throws(() => assertConserved(story, { ...good, remainder: '' }), /not conserved/))
test('conservation catches a duplicated line', () => assert.throws(() => assertConserved(story, { ...good, lines: [...good.lines, good.lines[2]] }), /not conserved/))
test('conservation catches swapped order', () => assert.throws(() => assertConserved(story, { ...good, lines: [good.lines[1], good.lines[0], good.lines[2]] }), /not conserved/))
test('conservation ignores whitespace at line ends', () => assertConserved('a b c', { lines: [{ text: 'a' }, { text: 'b' }, { text: 'c' }], remainder: '' }))
test('conservation keeps ZWJ/ZWNJ significant', () => assert.throws(() => assertConserved('क्‍ष', { lines: [{ text: 'क्ष' }], remainder: '' }), /not conserved/))
test('frame containment passes, and catches a line leaving its frame', () => {
  assertInsideFrames(good, frames, 21)
  assert.throws(() => assertInsideFrames({ lines: [{ frameId: 'a', x: 0, y: 30, w: 100, text: 'x' }] }, frames, 21), /leaves frame/)
  assert.throws(() => assertInsideFrames({ lines: [{ frameId: 'a', x: 50, y: 0, w: 100, text: 'x' }] }, frames, 21), /leaves frame/)
})
test('obstacle clearance catches an overlap and respects margin', () => {
  const o = [{ x: 60, y: 0, w: 30, h: 20, margin: 4 }]
  assert.throws(() => assertClearOfObstacles({ lines: [{ x: 0, y: 0, w: 100, text: 'x' }] }, o, 21), /overlaps/)
  assert.throws(() => assertClearOfObstacles({ lines: [{ x: 0, y: 0, w: 58, text: 'x' }] }, o, 21), /overlaps/)   // inside the 4px margin
  assertClearOfObstacles({ lines: [{ x: 0, y: 0, w: 55, text: 'x' }] }, o, 21)
  assertClearOfObstacles({ lines: [{ x: 0, y: 30, w: 100, text: 'x' }] }, o, 21)                                    // below it
})
test('fit check catches overwide text', () => {
  assertFits({ lines: [{ w: 70, text: 'abcdefghij' }] }, fakeWidth)
  assert.throws(() => assertFits({ lines: [{ w: 60, text: 'abcdefghij' }] }, fakeWidth), /wider/)
})
test('fit check lets a single unsplittable grapheme overflow a too-narrow box', () => assertFits({ lines: [{ w: 10, text: 'बा' }] }, fakeWidth))
test('fake width ignores combining marks and halant', () => assert.equal(fakeWidth('क्ष'), fakeWidth('क') + fakeWidth('ष')))
test('reading order catches frame b before frame a', () =>
  assert.throws(() => assertReadingOrder({ lines: [{ frameId: 'b', y: 0, text: '1' }, { frameId: 'a', y: 0, text: '2' }] }, frames), /reading order/))
test('determinism check catches random output', () => {
  assertDeterministic(() => ({ a: 1 }))
  assert.throws(() => assertDeterministic(() => ({ a: Math.random() })), /not deterministic/)
})

// ---- undo fuzzer, exercised on a toy document so Phase 1 can plug in real ops
const toyOps = (bug = false) => [
  { name: 'insert', gen: (r, d) => ({ at: int(r, 0, d.items.length), v: int(r, 0, 99) }),
    apply: (d, { at, v }) => ({ doc: { items: [...d.items.slice(0, at), v, ...d.items.slice(at)] }, inverse: x => ({ items: [...x.items.slice(0, at), ...x.items.slice(at + 1)] }) }) },
  { name: 'delete', gen: (r, d) => d.items.length ? { at: int(r, 0, d.items.length - 1) } : null,
    apply: (d, { at }) => { const v = d.items[at]; return { doc: { items: [...d.items.slice(0, at), ...d.items.slice(at + 1)] },
      inverse: x => ({ items: [...x.items.slice(0, at), bug ? v + 1 : v, ...x.items.slice(at)] }) } } },
]
const makeDoc = r => ({ items: Array.from({ length: int(r, 0, 6) }, () => int(r, 0, 99)) })

test('undo fuzzer passes for correct inverses', () => fuzzUndo({ makeDoc, ops: toyOps(false), runs: 100 }))
test('undo fuzzer catches an inverse that restores the wrong value, and reports a seed', () =>
  assert.throws(() => fuzzUndo({ makeDoc, ops: toyOps(true), runs: 100 }), /\[fuzz seed \d+\]/))
test('undo fuzzer catches an op that mutates its input', () => {
  const mutating = [{ name: 'push', gen: () => ({}), apply: d => { d.items.push(1); return { doc: d, inverse: x => { x.items.pop(); return x } } } }]
  assert.throws(() => fuzzUndo({ makeDoc, ops: mutating, runs: 20 }), /mutated|did not restore/)
})
