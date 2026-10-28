// Thread a story through ordered frames around obstacles (Phase 0 task 5). Pure and DOM-free: Pretext measures
// through OffscreenCanvas, which the browser provides and Node tests fake. Contract: docs/TESTING.md.
import { prepareWithSegments, layoutNextLine, setLocale } from '@chenglou/pretext'

setLocale('hi')
const EPS = 0.01
// Narrowest gap beside an obstacle that takes text, in ems of the body size (D-020). A frame narrower than this still takes text.
export const MIN_GAP_EM = 6

// Free horizontal gaps of [x0, x1] left by obstacles that touch the line band [y, y + lh).
function gaps(x0, x1, y, lh, obstacles) {
  const cuts = obstacles.map(o => [o.x - (o.margin ?? 0), o.x + o.w + (o.margin ?? 0), o.y - (o.margin ?? 0), o.y + o.h + (o.margin ?? 0)])
    .filter(([a, b, top, bot]) => top < y + lh && bot > y && a < x1 && b > x0)
    .sort((p, q) => p[0] - q[0])
  const out = []; let x = x0
  for (const [a, b] of cuts) { if (a > x) out.push([x, a]); x = Math.max(x, b) }
  if (x1 > x) out.push([x, x1])
  return out
}

// flow(story, frames:[{id,x,y,w,h}], obstacles:[{x,y,w,h,margin}], {font, lineHeight}) -> { lines:[{frameId,x,y,w,text}], remainder }
export function flow(story, frames, obstacles = [], { font, lineHeight }) {
  const size = parseFloat(/([\d.]+)px/.exec(font)?.[1])
  if (!(size > 0)) throw new Error(`flow(): font "${font}" has no px size`)
  const p = prepareWithSegments(story, font)
  let cursor = { segmentIndex: 0, graphemeIndex: 0 }, done = false
  const lines = []
  for (const f of frames) {
    for (let y = f.y; !done && y + lineHeight <= f.y + f.h + EPS; y += lineHeight) {
      // An obstacle splitting the line leaves two gaps: we use only the larger one (leftmost on a tie), never both.
      const g = gaps(f.x, f.x + f.w, y, lineHeight, obstacles).reduce((best, s) => (s[1] - s[0] > best[1] - best[0] + EPS ? s : best), [0, 0])
      const w = g[1] - g[0]
      if (w <= EPS || w < Math.min(MIN_GAP_EM * size, f.w) - EPS) continue
      // Pretext breaks a word that does not fit at a grapheme cluster boundary.
      const line = layoutNextLine(p, w, cursor)
      if (!line) { done = true; break }
      if (line.width > w + EPS) continue                                 // not even one grapheme fits: try the next line
      lines.push({ frameId: f.id, x: g[0], y, w, text: line.text })
      cursor = line.end
    }
  }
  let remainder = ''
  for (let line; (line = layoutNextLine(p, Infinity, cursor)); cursor = line.end) remainder += line.text
  return { lines, remainder }
}
