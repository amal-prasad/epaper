// Wrap modes and shaped objects (D-035, D-036, D-038). The checks work the geometry out independently of wrap.js, from
// the object itself: no line inside the shape plus its offset, and no empty band at or above the minimum gap (GG-041).
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { installFakeCanvas, fakeWidth } from './helpers/fake-canvas.js'
import { assertAll } from './helpers/invariants.js'
import { wrapObstacles, roundPolygon, assertWrap } from '../src/wrap.js'
import { apply } from '../src/ops.js'
import { assertDoc } from '../src/doc.js'

installFakeCanvas()
const { flow, MIN_GAP_EM } = await import('../src/flow.js')

const para = fs.readFileSync(new URL('../../../spike/samples/janshakti-live.txt', import.meta.url), 'utf8').replace(/\s+/g, ' ').trim()
const story = para.slice(0, 16000)
const SIZE = 14, LH = 21, EM = SIZE
const frames = [{ id: 'a', x: 0, y: 0, w: 400, h: 630 }, { id: 'b', x: 420, y: 0, w: 400, h: 630 }]
const ZERO = { top: 0, right: 0, bottom: 0, left: 0 }

const object = (x, y, w, h, wrap, extra = {}) => ({ id: 'o', x, y, w, h, wrap: { offset: ZERO, ...wrap }, ...extra })
const layout = (objects, useFrames = frames) => {
  const obstacles = wrapObstacles(objects, useFrames, { lineHeight: LH })
  const r = flow(story, useFrames, obstacles, { font: `${SIZE}px "Fake"`, lineHeight: LH })
  assertAll(story, r, { frames: useFrames, obstacles, lineHeight: LH, measure: fakeWidth })
  return r
}

// The object's outline on the page, worked out here and not by wrap.js.
function outline(o) {
  const fractions = o.wrap.mode === 'shape' ? o.wrap.polygon : [[0, 0], [1, 0], [1, 1], [0, 1]]
  const a = (o.rot ?? 0) * Math.PI / 180, cx = o.x + o.w / 2, cy = o.y + o.h / 2
  return fractions.map(([fx, fy]) => {
    const dx = o.x + fx * o.w - cx, dy = o.y + fy * o.h - cy
    return [cx + dx * Math.cos(a) - dy * Math.sin(a), cy + dx * Math.sin(a) + dy * Math.cos(a)]
  })
}
// Where the outline is solid on the horizontal line at y, as [from, to] pairs (even-odd).
function solidAt(pts, y) {
  const xs = []
  for (let i = 0; i < pts.length; i++) {
    const [x1, y1] = pts[i], [x2, y2] = pts[(i + 1) % pts.length]
    if ((y1 <= y && y < y2) || (y2 <= y && y < y1)) xs.push(x1 + (y - y1) * (x2 - x1) / (y2 - y1))
  }
  xs.sort((p, q) => p - q)
  const out = []
  for (let i = 0; i + 1 < xs.length; i += 2) out.push([xs[i], xs[i + 1]])
  return out
}
// Sampled blocked runs for one line band, with the offsets applied. Sampling can only miss a little, so checks allow a margin.
function blockedInBand(o, y) {
  const pts = outline(o), { top, right, bottom, left } = o.wrap.offset, out = []
  for (let py = y - bottom; py <= y + LH + top; py += 0.25) for (const [a, b] of solidAt(pts, py)) out.push([a - left, b + right])
  return out
}
function assertClear(r, o) {
  for (const l of r.lines) for (const [a, b] of blockedInBand(o, l.y))
    assert.ok(a >= l.x + l.w - 1e-6 || b <= l.x + 1e-6, `line at y ${l.y} x ${l.x}..${l.x + l.w} enters the shape at ${a}..${b}`)
}
function assertNoEmptyBand(r, o, minGapEm = MIN_GAP_EM, useFrames = frames) {
  const need = minGapEm * EM + 2
  for (const f of useFrames) for (let y = f.y; y + LH <= f.y + f.h + 0.01; y += LH) {
    const blocked = blockedInBand(o, y)
    let run = 0, from = f.x
    for (let x = f.x; x <= f.x + f.w; x += 0.5) {
      const free = x < f.x + f.w && !blocked.some(([a, b]) => x + 0.5 > a && x < b)
      if (free) { if (!run) from = x; run += 0.5 }
      if (!free || x === f.x + f.w) {
        if (run >= need) assert.ok(r.lines.some(l => l.frameId === f.id && Math.abs(l.y - y) < 1e-6 && l.x < from + run && l.x + l.w > from),
          `frame ${f.id} y ${y}: ${run} wide gap at ${from} has no line`)
        run = 0
      }
    }
  }
}

const U = [[0, 0], [0.3, 0], [0.3, 0.7], [0.7, 0.7], [0.7, 0], [1, 0], [1, 1], [0, 1]]     // a cut-out with a notch from the top
const blob = Array.from({ length: 40 }, (_, i) => { const a = i * Math.PI / 20, r = 0.42 + 0.06 * Math.sin(3 * a); return [0.5 + r * Math.cos(a), 0.5 + r * Math.sin(a)] })
const offset = { top: 3, right: 9, bottom: 5, left: 7 }
const SHAPES = {
  box: object(100, 100, 200, 200, { mode: 'box' }),
  'box with offsets on each side': object(100, 100, 200, 200, { mode: 'box', offset }),
  'box across the gutter': object(300, 100, 220, 200, { mode: 'box', offset }),
  'rotated box': object(120, 120, 180, 120, { mode: 'box', offset }, { rot: 25 }),
  round: object(80, 100, 240, 240, { mode: 'shape', polygon: roundPolygon(), offset }),
  'round across the gutter': object(290, 100, 240, 240, { mode: 'shape', polygon: roundPolygon(), offset }),
  'cut-out, free form': object(90, 90, 240, 280, { mode: 'shape', polygon: blob, offset }),
  'cut-out with a notch': object(40, 100, 340, 300, { mode: 'shape', polygon: U, offset }),
  'rotated cut-out': object(90, 110, 220, 220, { mode: 'shape', polygon: blob, offset }, { rot: 40 }),
}
for (const [name, o] of Object.entries(SHAPES)) {
  test(`${name}: no line inside the shape plus its offset`, () => assertClear(layout([o]), o))
  test(`${name}: no empty band at or above the minimum gap`, () => assertNoEmptyBand(layout([o]), o))
}

// Mutation check: the real wrap.js with a fault put in on purpose. The two geometry checks above must fail on it.
const WRAP_SOURCE = fs.readFileSync(new URL('../src/wrap.js', import.meta.url), 'utf8')
const WRAP_MUTANTS = [
  { name: 'shape ignores its left offset', from: 'Math.max(a - offset.left, f.x)', to: 'Math.max(a, f.x)', shape: 'round', check: assertClear, expect: /enters the shape/ },
  { name: 'shape ignores its top offset', from: 'y + lineHeight + offset.top)', to: 'y + lineHeight)', shape: 'round', check: assertClear, expect: /enters the shape/ },
  { name: 'shape slices a band too short', from: 'y - offset.bottom, y + lineHeight', to: 'y - offset.bottom, y + lineHeight / 2', shape: 'round', check: assertClear, expect: /enters the shape/ },
  { name: 'rotation is ignored', from: 'cx + dx * cos - dy * sin, cy + dx * sin + dy * cos', to: 'cx + dx, cy + dy', shape: 'rotated box', check: assertClear, expect: /enters the shape/ },
  { name: 'a notch is filled in, so the band inside it stays empty', from: 'if (last && a <= last[1])', to: 'if (last)', shape: 'cut-out with a notch', check: assertNoEmptyBand, expect: /has no line/ },
  { name: 'slices run wider than the shape', from: 'x1 = Math.min(b + offset.right, f.x + f.w)', to: 'x1 = Math.min(b + offset.right + 80, f.x + f.w)', shape: 'round', check: assertNoEmptyBand, expect: /has no line/ },
]
for (const m of WRAP_MUTANTS) {
  test(`mutation check, geometry check fails when: ${m.name}`, async () => {
    assert.equal(WRAP_SOURCE.split(m.from).length, 2, `mutation target must appear exactly once in wrap.js: ${m.from}`)
    const mutated = await import('data:text/javascript;base64,' + Buffer.from(WRAP_SOURCE.replace(m.from, m.to)).toString('base64'))
    const o = SHAPES[m.shape]
    const r = flow(story, frames, mutated.wrapObstacles([o], frames, { lineHeight: LH }), { font: `${SIZE}px "Fake"`, lineHeight: LH })
    assert.throws(() => m.check(r, o), m.expect)
  })
}

test('wrap mode none: text ignores the object', () => {
  const o = object(100, 100, 200, 200, { mode: 'none' })
  assert.deepEqual(wrapObstacles([o], frames, { lineHeight: LH }), [])
  assert.deepEqual(layout([o]).lines, layout([]).lines)
})

test('box: each side keeps its own offset', () => {
  const o = object(100, 105, 200, 210, { mode: 'box', offset })
  const [only] = wrapObstacles([o], frames, { lineHeight: LH })
  assert.deepEqual([only.x, only.y, only.w, only.h, only.margin], [93, 102, 216, 218, 0])
})

test('jump: no text beside the object, text resumes below, and only the columns it touches clear', () => {
  const o = object(100, 105, 100, 105, { mode: 'jump', offset: { top: 0, right: 0, bottom: 0, left: 0 } })
  const r = layout([o])
  const a = r.lines.filter(l => l.frameId === 'a'), b = r.lines.filter(l => l.frameId === 'b')
  assert.ok(!a.some(l => l.y + LH > 105 && l.y < 210), 'a line sits beside a jump object')
  assert.ok(a.some(l => l.y >= 210), 'text does not resume below the object')
  assert.equal(b.length, 30, 'the other column is untouched')
  assert.ok(a.every(l => l.w === 400), 'lines keep the full width')
})

test('jump across the gutter clears both columns', () => {
  const r = layout([object(350, 105, 120, 105, { mode: 'jump' })])
  assert.ok(!r.lines.some(l => l.y + LH > 105 && l.y < 210))
})

test('lines beside a shape carry align; lines beside a plain box stay justified (D-038)', () => {
  const box = layout([object(100, 105, 200, 105, { mode: 'box' })])
  assert.ok(box.lines.every(l => l.align === undefined))
  const round = layout([SHAPES.round])
  const beside = round.lines.filter(l => l.frameId === 'a' && l.w < 400)
  assert.ok(beside.length > 5)
  assert.ok(beside.every(l => l.align === 'left' || l.align === 'right'))
  assert.ok(round.lines.filter(l => l.w === 400).every(l => l.align === undefined))
  const rotated = layout([SHAPES['rotated box']])
  assert.ok(rotated.lines.some(l => l.align), 'a rotated box counts as a shape')
})

test('a text line sets inside the notch of a cut-out', () => {
  const o = SHAPES['cut-out with a notch']
  const inside = layout([o]).lines.filter(l => l.frameId === 'a' && l.y >= 105 && l.y + LH < 300 && l.x > 140 && l.x + l.w < 280)
  assert.ok(inside.length > 3, 'no lines in the notch')
})

test('minimum gap is per object: 3 em by default, wider or narrower when set', () => {
  // The object leaves a 50 wide gap on its left, and more on its right.
  const place = wrap => object(50, 105, 100, 105, { mode: 'box', ...wrap })
  const leftGap = r => r.lines.filter(l => l.frameId === 'a' && l.x === 0 && l.w === 50).length
  assert.equal(MIN_GAP_EM, 3)
  assert.ok(leftGap(layout([place({})])) > 0, '50 is above the default 42')
  assert.equal(leftGap(layout([place({ minGap: 5 })])), 0, '50 is below 5 em')
  const narrow = object(30, 105, 100, 105, { mode: 'box', minGap: 2 })
  assert.ok(layout([narrow]).lines.some(l => l.x === 0 && l.w === 30), '30 is above 2 em')
  assert.ok(!layout([object(30, 105, 100, 105, { mode: 'box' })]).lines.some(l => l.x === 0 && l.w === 30), '30 is below the default')
})

test('minimum gap: a gap between two objects takes the larger of their settings', () => {
  const a = { ...object(0, 105, 100, 105, { mode: 'box', minGap: 2 }), id: 'a' }, b = { ...object(150, 105, 100, 105, { mode: 'box', minGap: 5 }), id: 'b' }
  assert.ok(!layout([a, b]).lines.some(l => l.x === 100 && l.w === 50))
  const c = { ...b, wrap: { ...b.wrap, minGap: 2 } }
  assert.ok(layout([a, c]).lines.some(l => l.x === 100 && l.w === 50))
})

test('a shape scales and moves with its object, since the polygon is stored in fractions', () => {
  const doc = {
    schemaVersion: 1, id: 'd', orgId: 'o', stories: [],
    pages: [{ id: 'p', orgId: 'o', no: 1, frames: [], objects: [{ ...SHAPES.round, orgId: 'o', kind: 'photo', z: 0, style: {} }] }],
  }
  const moved = apply(doc, { type: 'setObjectGeometry', args: { objectId: 'o', x: 20, y: 200, w: 120, h: 300 } }).doc.pages[0].objects[0]
  assert.deepEqual(moved.wrap.polygon, SHAPES.round.wrap.polygon)
  assertClear(layout([moved]), moved)
  assertNoEmptyBand(layout([moved]), moved)
})

test('wrapObstacles is deterministic and does not change the objects', () => {
  const o = structuredClone(SHAPES['rotated cut-out']), copy = structuredClone(o)
  assert.deepEqual(wrapObstacles([o], frames, { lineHeight: LH }), wrapObstacles([o], frames, { lineHeight: LH }))
  assert.deepEqual(o, copy)
})

test('a frame with a different line grid is not cut by another frame\'s slices', () => {
  const useFrames = [{ id: 'a', x: 0, y: 0, w: 400, h: 630 }, { id: 'b', x: 420, y: 7, w: 400, h: 623 }]
  const o = object(290, 100, 240, 240, { mode: 'shape', polygon: roundPolygon(), offset })
  const r = layout([o], useFrames)
  assertClear(r, o)
  assertNoEmptyBand(r, o, MIN_GAP_EM, useFrames)
})

test('assertWrap refuses a wrap the engine cannot lay out', () => {
  const good = { mode: 'shape', polygon: roundPolygon(), offset: ZERO, minGap: 3 }
  assert.doesNotThrow(() => assertWrap(good))
  const bad = {
    'unknown mode': { mode: 'contour' }, 'no mode': {},
    'negative offset': { mode: 'box', offset: { ...ZERO, left: -1 } },
    'offset not a number': { mode: 'box', offset: { ...ZERO, top: '1' } },
    'zero minimum gap': { mode: 'box', minGap: 0 },
    'shape with no polygon': { mode: 'shape' },
    'polygon of two points': { mode: 'shape', polygon: [[0, 0], [1, 1]] },
    'polygon with a bad point': { mode: 'shape', polygon: [[0, 0], [1, NaN], [1, 1]] },
  }
  for (const [name, wrap] of Object.entries(bad)) assert.throws(() => assertWrap(wrap), /wrap/, name)
})

test('setWrap: refuses a bad wrap; the document check refuses one too', () => {
  const doc = { schemaVersion: 1, id: 'd', orgId: 'o', preset: undefined, stories: [], pages: [{ id: 'p', orgId: 'o', no: 1, frames: [], objects: [{ ...SHAPES.box, orgId: 'o' }] }] }
  assert.throws(() => apply(doc, { type: 'setWrap', args: { objectId: 'o', wrap: { mode: 'shape' } } }), /wrap/)
  const { doc: out, inverse } = apply(doc, { type: 'setWrap', args: { objectId: 'o', wrap: { mode: 'jump', offset: ZERO } } })
  assert.equal(out.pages[0].objects[0].wrap.mode, 'jump')
  assert.deepEqual(apply(out, JSON.parse(JSON.stringify(inverse))).doc, doc)
  assert.throws(() => assertDoc({ ...doc, preset: { bad: true } }))
})
