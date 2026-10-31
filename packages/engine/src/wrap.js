// Turns page objects into flow() obstacles (D-035, D-036, D-038). Pure; objects, frames and lineHeight share one unit.
//   object.wrap = { mode: 'none'|'box'|'shape'|'jump', offset: { top, right, bottom, left }, minGap?: ems, polygon?: [[fx, fy], ...] }
// polygon points are fractions of the object's width and height, so a shape moves and scales with its object.
// An outline is extracted outside the engine, at upload; the engine only reads the stored polygon.

const EPS = 0.01
const MODES = ['none', 'box', 'shape', 'jump']
const fail = message => { throw new Error(`bad wrap: ${message}`) }

// The tops of a frame's text lines. flow() and the slicing below must use the same grid.
export function lineTops(frame, lineHeight) {
  const out = []
  for (let y = frame.y; y + lineHeight <= frame.y + frame.h + EPS; y += lineHeight) out.push(y)
  return out
}

// A preset outline: a circle in a square object, an ellipse otherwise.
export const roundPolygon = (points = 72) =>
  Array.from({ length: points }, (_, i) => [0.5 + 0.5 * Math.cos(2 * Math.PI * i / points), 0.5 + 0.5 * Math.sin(2 * Math.PI * i / points)])

export function assertWrap(wrap) {
  if (!MODES.includes(wrap?.mode)) fail(`unknown wrap mode ${wrap?.mode}`)
  for (const side of ['top', 'right', 'bottom', 'left']) {
    const v = wrap.offset?.[side]
    if (v !== undefined && !(Number.isFinite(v) && v >= 0)) fail(`offset ${side} must be 0 or more`)
  }
  if (wrap.minGap !== undefined && !(Number.isFinite(wrap.minGap) && wrap.minGap > 0)) fail('minGap must be above 0')
  if (wrap.mode === 'shape' && !(Array.isArray(wrap.polygon) && wrap.polygon.length >= 3)) fail('a shape needs a polygon of 3 or more points')
  if (wrap.polygon?.some(p => !(Array.isArray(p) && Number.isFinite(p[0]) && Number.isFinite(p[1])))) fail('a polygon point is not two numbers')
}

const BOX = [[0, 0], [1, 0], [1, 1], [0, 1]]

// The object's outline on the page, rotated about its centre.
function outline(o) {
  const a = (o.rot ?? 0) * Math.PI / 180, cos = Math.cos(a), sin = Math.sin(a), cx = o.x + o.w / 2, cy = o.y + o.h / 2
  return (o.wrap.mode === 'shape' ? o.wrap.polygon : BOX).map(([fx, fy]) => {
    const dx = o.x + fx * o.w - cx, dy = o.y + fy * o.h - cy
    return [cx + dx * cos - dy * sin, cy + dx * sin + dy * cos]
  })
}

// Every x range the polygon covers anywhere between y0 and y1, merged. Exact for a polygon whose edges do not cross: between
// two vertex heights its edges keep their order, so each solid piece runs from one edge's outer x to the next one's.
function coveredRanges(pts, y0, y1) {
  const stops = [...new Set([y0, y1, ...pts.map(p => p[1]).filter(y => y > y0 && y < y1)])].sort((a, b) => a - b)
  const edges = pts.map((p, i) => [p, pts[(i + 1) % pts.length]]).filter(([p, q]) => p[1] !== q[1])
  const xAt = ([p, q], y) => p[0] + (y - p[1]) * (q[0] - p[0]) / (q[1] - p[1])
  const ranges = []
  for (let i = 0; i + 1 < stops.length; i++) {
    const s = stops[i], t = stops[i + 1], mid = (s + t) / 2
    const crossing = edges.filter(([p, q]) => Math.min(p[1], q[1]) <= s && Math.max(p[1], q[1]) >= t).sort((e, f) => xAt(e, mid) - xAt(f, mid))
    for (let k = 0; k + 1 < crossing.length; k += 2) {
      const [a, b] = [crossing[k], crossing[k + 1]]
      ranges.push([Math.min(xAt(a, s), xAt(a, t)), Math.max(xAt(b, s), xAt(b, t))])
    }
  }
  ranges.sort((a, b) => a[0] - b[0])
  const merged = []
  for (const [a, b] of ranges) {
    const last = merged.at(-1)
    if (last && a <= last[1]) last[1] = Math.max(last[1], b)
    else merged.push([a, b])
  }
  return merged
}

// One obstacle per covered range per line band, cut to the frame: slices only need to hold for that frame's own line grid.
function shapeObstacles(pts, offset, frames, lineHeight, extra) {
  const out = []
  for (const f of frames) for (const y of lineTops(f, lineHeight))
    for (const [a, b] of coveredRanges(pts, y - offset.bottom, y + lineHeight + offset.top)) {
      const x0 = Math.max(a - offset.left, f.x), x1 = Math.min(b + offset.right, f.x + f.w)
      if (x1 > x0) out.push({ x: x0, y, w: x1 - x0, h: lineHeight, margin: 0, shape: 'contour', ...extra })
    }
  return out
}

// wrapObstacles(objects, frames, { lineHeight }) -> obstacles for flow(). Pass the same frames and lineHeight to flow().
export function wrapObstacles(objects, frames, { lineHeight }) {
  const out = []
  for (const o of objects) {
    const { mode, minGap } = o.wrap
    if (mode === 'none') continue
    const offset = { top: 0, right: 0, bottom: 0, left: 0, ...o.wrap.offset }
    const extra = minGap === undefined ? {} : { minGapEm: minGap }
    const pts = outline(o), xs = pts.map(p => p[0]), ys = pts.map(p => p[1])
    const left = Math.min(...xs) - offset.left, right = Math.max(...xs) + offset.right
    const top = Math.min(...ys) - offset.top, bottom = Math.max(...ys) + offset.bottom
    if (mode === 'jump') {
      for (const f of frames) if (left < f.x + f.w && right > f.x) out.push({ x: f.x, y: top, w: f.w, h: bottom - top, margin: 0, shape: 'box', ...extra })
    } else if (mode === 'box' && !o.rot) {
      out.push({ x: left, y: top, w: right - left, h: bottom - top, margin: 0, shape: 'box', ...extra })
    } else {
      out.push(...shapeObstacles(pts, offset, frames, lineHeight, extra))
    }
  }
  return out
}
