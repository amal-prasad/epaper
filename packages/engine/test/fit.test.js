// Fit meters: fit() returns fill %, overflow lines and underfill lines. Whether it matches a real browser with real fonts
// is scripts/measure-fit.mjs (gate G1.fitdrift); these tests pin the logic on the fake font.
import test from 'node:test'
import assert from 'node:assert/strict'
import { installFakeCanvas } from './helpers/fake-canvas.js'
import { rng, int } from './helpers/fuzz.js'

installFakeCanvas()
const { flow, fit } = await import('../src/flow.js')

const opts = { font: '14px "Fake"', lineHeight: 20 }
// 10 characters plus a space, so at 7 px each a frame 77 px wide takes exactly one word per line.
const words = n => Array.from({ length: n }, () => 'कखगघङचछजझञ').join(' ')
const frame = (lines, id = 'a', x = 0) => ({ id, x, y: 0, w: 77, h: lines * 20 })

test('a story that exactly fills its frame: 100%, nothing over, nothing under', () => {
  assert.deepEqual(fit(words(5), [frame(5)], [], opts), { fillPct: 100, lines: 5, capacity: 5, overflowLines: 0, underfillLines: 0 })
})

test('a short story: underfill lines are the empty slots', () => {
  assert.deepEqual(fit(words(2), [frame(5)], [], opts), { fillPct: 40, lines: 2, capacity: 5, overflowLines: 0, underfillLines: 3 })
})

test('a long story: overflow lines are what does not fit, and fill goes past 100', () => {
  assert.deepEqual(fit(words(8), [frame(5)], [], opts), { fillPct: 160, lines: 5, capacity: 5, overflowLines: 3, underfillLines: 0 })
})

test('capacity counts every frame in the chain', () => {
  const r = fit(words(7), [frame(5), frame(5, 'b', 100)], [], opts)
  assert.deepEqual(r, { fillPct: 70, lines: 7, capacity: 10, overflowLines: 0, underfillLines: 3 })
})

test('an obstacle takes its lines out of the capacity', () => {
  const photo = { x: 0, y: 20, w: 77, h: 40, margin: 0 }
  assert.deepEqual(fit(words(3), [frame(5)], [photo], opts), { fillPct: 100, lines: 3, capacity: 3, overflowLines: 0, underfillLines: 0 })
  assert.equal(fit(words(4), [frame(5)], [photo], opts).overflowLines, 1)
})

test('a gap below the minimum takes no text and is not capacity', () => {
  const photo = { x: 40, y: 0, w: 37, h: 100, margin: 0 }     // leaves 40 px, under the 3 em minimum of 42
  assert.deepEqual(fit(words(1), [frame(5)], [photo], opts), { fillPct: Infinity, lines: 0, capacity: 0, overflowLines: 1, underfillLines: 0 })
})

test('empty text in an empty frame list is 0%, not an error', () => {
  assert.deepEqual(fit('', [frame(5)], [], opts), { fillPct: 0, lines: 0, capacity: 5, overflowLines: 0, underfillLines: 5 })
  assert.deepEqual(fit('', [], [], opts), { fillPct: 0, lines: 0, capacity: 0, overflowLines: 0, underfillLines: 0 })
  assert.deepEqual(fit('   ', [frame(2)], [], opts), { fillPct: 0, lines: 0, capacity: 2, overflowLines: 0, underfillLines: 2 })
})

test('text with no space that is wider than the frame still counts every line', () => {
  const r = fit('क'.repeat(40), [frame(2)], [], opts)     // 11 characters a line: 4 lines, 2 of them over
  assert.equal(r.lines, 2)
  assert.equal(r.overflowLines, 2)
})

test('on random cases fit agrees with flow, and its numbers add up', () => {
  const r = rng(5)
  for (let i = 0; i < 300; i++) {
    const frames = [{ id: 'a', x: 0, y: 0, w: int(r, 60, 300), h: int(r, 0, 12) * 20 }, { id: 'b', x: 320, y: 0, w: int(r, 60, 300), h: int(r, 0, 12) * 20 }]
    const obstacles = r() < 0.5 ? [{ x: int(r, 0, 300), y: int(r, 0, 200), w: int(r, 10, 200), h: int(r, 10, 100), margin: int(r, 0, 8) }] : []
    const text = words(int(r, 0, 60))
    const f = fit(text, frames, obstacles, opts), set = flow(text, frames, obstacles, opts)
    assert.equal(f.lines, set.lines.length, 'fit and flow set different line counts')
    assert.equal(f.overflowLines > 0, set.remainder.trim() !== '', 'overflow must mean flow left text over')
    if (f.overflowLines === 0) assert.equal(f.lines + f.underfillLines, f.capacity)
    else assert.equal(f.underfillLines, 0)
    assert.deepEqual(fit(text, frames, obstacles, opts), f, 'fit must be deterministic')
  }
})
