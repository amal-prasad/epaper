// Thread a story through ordered frames around obstacles (Phase 0 task 5). Pure and DOM-free: Pretext measures
// through OffscreenCanvas, which the browser provides and Node tests fake. Contract: docs/TESTING.md.
import { prepareWithSegments, layoutNextLine, setLocale } from '@chenglou/pretext'
import { lineTops } from './wrap.js'

setLocale('hi')
const EPS = 0.01
// Narrowest gap beside an obstacle that takes text, in ems of the body size (D-020, 3 em since D-037). A frame narrower
// than this still takes text.
export const MIN_GAP_EM = 3

// Free horizontal gaps of [x0, x1] left by obstacles that touch the line band [y, y + lh), as [x0, x1, leftIsContour,
// rightIsContour, minGapEm]: whether the obstacle defining each boundary has shape 'contour', and the larger minimum of
// those two obstacles. A gap with no obstacle at either side is the whole frame, which always takes text.
function gaps(x0, x1, y, lh, obstacles) {
  const cuts = obstacles.map(o => [o.x - (o.margin ?? 0), o.x + o.w + (o.margin ?? 0), o.y - (o.margin ?? 0), o.y + o.h + (o.margin ?? 0), o.shape === 'contour', o.minGapEm ?? MIN_GAP_EM])
    .filter(([a, b, top, bot]) => top < y + lh && bot > y && a < x1 && b > x0)
    .sort((p, q) => p[0] - q[0])
  const out = []; let x = x0, xc = false, xm = 0
  for (const [a, b, , , c, m] of cuts) { if (a > x) out.push([x, a, xc, c, Math.max(xm, m)]); if (b > x) { x = b; xc = c; xm = m } }
  if (x1 > x) out.push([x, x1, xc, false, xm])
  return out
}

// flow(story, frames:[{id,x,y,w,h}], obstacles:[{x,y,w,h,margin}], {font, lineHeight})
//   -> { lines:[{frameId,x,y,w,text,align?}], remainder }
// obstacle.shape: 'box' (default) or 'contour' (round, rotated, free-form). Only contour obstacles cause align (D-038).
// obstacle.minGapEm: the narrowest gap beside this obstacle that takes text (default MIN_GAP_EM). wrap.js builds obstacles.
// align: 'left' when a contour bounds the line on its right only, 'right' when on its left only, 'left' between two (the
// line stays flush with the edge away from the shape; renderers do not justify it). Absent on lines no contour touches,
// including lines beside plain boxes, which stay justified.
export function flow(story, frames, obstacles = [], { font, lineHeight }) {
  const p = prepareWithSegments(story, font)
  let cursor = { segmentIndex: 0, graphemeIndex: 0 }
  const lines = []
  for (const { frame: f, y, x0, x1, cutLeft, cutRight } of lineSlots(frames, obstacles, font, lineHeight)) {
    const w = x1 - x0
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
  let remainder = ''
  for (let line; (line = layoutNextLine(p, Infinity, cursor)); cursor = line.end) remainder += line.text
  return { lines, remainder }
}

// Every place a line of text can go, in reading order. An obstacle splitting the line leaves several gaps: every gap of at
// least the minimum takes text, left to right (D-037).
function lineSlots(frames, obstacles, font, lineHeight) {
  const size = parseFloat(/([\d.]+)px/.exec(font)?.[1])
  if (!(size > 0)) throw new Error(`flow(): font "${font}" has no px size`)
  const slots = []
  for (const frame of frames) for (const y of lineTops(frame, lineHeight))
    for (const [x0, x1, cutLeft, cutRight, minGapEm] of gaps(frame.x, frame.x + frame.w, y, lineHeight, obstacles)) {
      const w = x1 - x0
      if (w <= EPS || w < Math.min(minGapEm * size, frame.w) - EPS) continue
      slots.push({ frame, y, x0, x1, cutLeft, cutRight })
    }
  return slots
}

// fit(text, frames, obstacles, { font, lineHeight }) -> { fillPct, lines, capacity, overflowLines, underfillLines }
//   lines: lines flow() sets. capacity: places a line can go. overflowLines: lines of leftover text, at the width of the last
//   frame. underfillLines: empty places. fillPct: (lines + overflowLines) / capacity, one decimal; above 100 means overflow;
//   Infinity when text has nowhere to go. A chain's frames are passed in reading order, the same as to flow().
// ponytail: takes plain text, like flow(); templates will decide how headline and paragraphs become frames and text.
export function fit(text, frames, obstacles = [], { font, lineHeight }) {
  const { lines, remainder } = flow(text, frames, obstacles, { font, lineHeight })
  const capacity = lineSlots(frames, obstacles, font, lineHeight).length
  let overflowLines = 0
  if (remainder.trim()) {
    const p = prepareWithSegments(remainder, font), width = frames.at(-1)?.w ?? Infinity
    let cursor = { segmentIndex: 0, graphemeIndex: 0 }
    for (let line; (line = layoutNextLine(p, width, cursor)); cursor = line.end) overflowLines++
  }
  const needed = lines.length + overflowLines
  const fillPct = needed === 0 ? 0 : capacity ? Math.round(needed / capacity * 1000) / 10 : Infinity
  return { fillPct, lines: lines.length, capacity, overflowLines, underfillLines: overflowLines ? 0 : capacity - lines.length }
}
