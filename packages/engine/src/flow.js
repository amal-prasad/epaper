// Thread a story through ordered frames around obstacles (Phase 0 task 5). Pure and DOM-free: Pretext measures
// through OffscreenCanvas, which the browser provides and Node tests fake. Contract: docs/TESTING.md.
import { prepareWithSegments, layoutNextLine, setLocale } from '@chenglou/pretext'

setLocale('hi')
const EPS = 0.01
// Narrowest gap beside an obstacle that takes text, in ems of the body size (D-020, 3 em since D-037). A frame narrower
// than this still takes text.
export const MIN_GAP_EM = 3

// Free horizontal gaps of [x0, x1] left by obstacles that touch the line band [y, y + lh), as [x0, x1, leftIsContour,
// rightIsContour]: whether the obstacle defining each boundary has shape 'contour'.
function gaps(x0, x1, y, lh, obstacles) {
  const cuts = obstacles.map(o => [o.x - (o.margin ?? 0), o.x + o.w + (o.margin ?? 0), o.y - (o.margin ?? 0), o.y + o.h + (o.margin ?? 0), o.shape === 'contour'])
    .filter(([a, b, top, bot]) => top < y + lh && bot > y && a < x1 && b > x0)
    .sort((p, q) => p[0] - q[0])
  const out = []; let x = x0, xc = false
  for (const [a, b, , , c] of cuts) { if (a > x) out.push([x, a, xc, c]); if (b > x) { x = b; xc = c } }
  if (x1 > x) out.push([x, x1, xc, false])
  return out
}

// flow(story, frames:[{id,x,y,w,h}], obstacles:[{x,y,w,h,margin}], {font, lineHeight})
//   -> { lines:[{frameId,x,y,w,text,align?}], remainder }
// obstacle.shape: 'box' (default) or 'contour' (round, rotated, free-form). Only contour obstacles cause align (D-038).
// align: 'left' when a contour bounds the line on its right only, 'right' when on its left only, 'left' between two (the
// line stays flush with the edge away from the shape; renderers do not justify it). Absent on lines no contour touches,
// including lines beside plain boxes, which stay justified.
export function flow(story, frames, obstacles = [], { font, lineHeight }) {
  const size = parseFloat(/([\d.]+)px/.exec(font)?.[1])
  if (!(size > 0)) throw new Error(`flow(): font "${font}" has no px size`)
  const p = prepareWithSegments(story, font)
  let cursor = { segmentIndex: 0, graphemeIndex: 0 }
  const lines = []
  for (const f of frames) {
    for (let y = f.y; y + lineHeight <= f.y + f.h + EPS; y += lineHeight) {
      // An obstacle splitting the line leaves several gaps: every gap of at least the minimum takes text, left to right (D-037).
      for (const [x0, x1, cutLeft, cutRight] of gaps(f.x, f.x + f.w, y, lineHeight, obstacles)) {
        const w = x1 - x0
        if (w <= EPS || w < Math.min(MIN_GAP_EM * size, f.w) - EPS) continue
        // Pretext breaks a word that does not fit at a grapheme cluster boundary.
        const line = layoutNextLine(p, w, cursor)
        if (!line) return { lines, remainder: '' }
        if (line.width > w + EPS) continue                               // not even one grapheme fits: try the next gap
        const l = { frameId: f.id, x: x0, y, w, text: line.text }
        if (cutRight && !cutLeft) l.align = 'left'
        else if (cutLeft && !cutRight) l.align = 'right'
        else if (cutLeft && cutRight) l.align = 'left'                   // between two obstacles: read from the left edge
        lines.push(l)
        cursor = line.end
      }
    }
  }
  let remainder = ''
  for (let line; (line = layoutNextLine(p, Infinity, cursor)); cursor = line.end) remainder += line.text
  return { lines, remainder }
}
