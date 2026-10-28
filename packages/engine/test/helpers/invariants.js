// Invariants every flow() result must satisfy, whatever the font, frames or obstacles.
// A flow result is { lines: [{frameId,x,y,w,text}], remainder: string }.
import assert from 'node:assert/strict'

export const squash = s => s.replace(/\s+/g, '')           // whitespace is allowed to change at line ends; nothing else is

// 1. Nothing lost, nothing duplicated, order preserved.
export function assertConserved(story, result) {
  const got = squash(result.lines.map(l => l.text).join('') + (result.remainder ?? ''))
  const want = squash(story)
  if (got !== want) {
    let i = 0; while (i < got.length && got[i] === want[i]) i++
    assert.fail(`text not conserved: first difference at character ${i}\n  story : ...${want.slice(Math.max(0, i - 15), i + 15)}\n  output: ...${got.slice(Math.max(0, i - 15), i + 15)}`)
  }
}

// 2. Every line sits inside its frame.
export function assertInsideFrames(result, frames, lineHeight, eps = 0.01) {
  const byId = new Map(frames.map(f => [f.id, f]))
  for (const l of result.lines) {
    const f = byId.get(l.frameId)
    assert.ok(f, `line refers to unknown frame ${l.frameId}`)
    assert.ok(l.x >= f.x - eps && l.x + l.w <= f.x + f.w + eps, `line "${l.text}" leaves frame ${f.id} horizontally`)
    assert.ok(l.y >= f.y - eps && l.y + lineHeight <= f.y + f.h + eps, `line "${l.text}" leaves frame ${f.id} vertically`)
  }
}

// 3. No line touches an obstacle (including its margin).
export function assertClearOfObstacles(result, obstacles, lineHeight, eps = 0.01) {
  for (const l of result.lines) for (const o of obstacles) {
    const m = o.margin ?? 0
    const hitX = l.x < o.x + o.w + m - eps && l.x + l.w > o.x - m + eps
    const hitY = l.y < o.y + o.h + m - eps && l.y + lineHeight > o.y - m + eps
    assert.ok(!(hitX && hitY), `line "${l.text}" overlaps obstacle at (${o.x},${o.y})`)
  }
}

// 4. Text never wider than the box it was placed in (needs a measure function).
//    Only exception: a single grapheme cluster, which cannot be split, so it may overflow a box narrower than itself.
const SEG = new Intl.Segmenter('hi', { granularity: 'grapheme' })
const graphemes = s => [...SEG.segment(s)].length
export function assertFits(result, measure, eps = 0.01) {
  for (const l of result.lines) {
    const t = l.text.trimEnd()
    if (graphemes(t) <= 1) continue
    assert.ok(measure(t) <= l.w + eps, `line "${l.text}" is wider (${measure(t)}) than its box (${l.w})`)
  }
}

// 5. Same input, same output.
export function assertDeterministic(run) {
  assert.deepEqual(run(), run(), 'flow() is not deterministic')
}

// 6. Lines of a frame are in reading order: top to bottom, and frames in the order given.
export function assertReadingOrder(result, frames) {
  const rank = new Map(frames.map((f, i) => [f.id, i]))
  let prev = null
  for (const l of result.lines) {
    if (prev) {
      const a = rank.get(prev.frameId), b = rank.get(l.frameId)
      assert.ok(b > a || (b === a && l.y >= prev.y), `lines out of reading order near "${l.text}"`)
    }
    prev = l
  }
}

export function assertAll(story, result, { frames, obstacles = [], lineHeight, measure }) {
  assertConserved(story, result)
  assertInsideFrames(result, frames, lineHeight)
  assertClearOfObstacles(result, obstacles, lineHeight)
  assertReadingOrder(result, frames)
  if (measure) assertFits(result, measure)
}
