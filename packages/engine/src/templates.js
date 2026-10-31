// A template is data (templates/*.json) in grid units, so it holds no sizes: a slot is col, span, row and rows on a grid of
// `columns` columns and `rows` rows. buildPage turns it into frames and objects using the document's preset (D-039).
//   { id, name, columns, rows, slots: [{ id, kind, col, span, row, rows, priority? }] }    kind: story, photo, masthead, imprint, ad
import { columnBoxes } from './preset.js'

const KIND_TO_OBJECT = { photo: 'photo', masthead: 'label', imprint: 'label', ad: 'ad' }
const fail = message => { throw new Error(`bad template: ${message}`) }
const whole = (v, min) => Number.isInteger(v) && v >= min

export function assertTemplate(t, preset) {
  if (!t?.id) fail('no id')
  if (t.columns !== preset.grid.cols) fail(`${t.id} is for ${t.columns} columns, the preset has ${preset.grid.cols}`)
  if (!whole(t.rows, 1) || !Array.isArray(t.slots)) fail(`${t.id} needs rows and slots`)
  const taken = new Set(), ids = new Set()
  for (const s of t.slots) {
    if (ids.has(s.id)) fail(`slot id ${s.id} is used twice`)
    ids.add(s.id)
    if (s.kind !== 'story' && !KIND_TO_OBJECT[s.kind]) fail(`slot ${s.id} has unknown kind ${s.kind}`)
    if (!(whole(s.col, 0) && whole(s.span, 1) && whole(s.row, 0) && whole(s.rows, 1))) fail(`slot ${s.id} needs whole grid numbers`)
    if (s.col + s.span > t.columns || s.row + s.rows > t.rows) fail(`slot ${s.id} leaves the grid`)
    if (s.kind === 'story' && ![1, 2, 3].includes(s.priority)) fail(`story slot ${s.id} needs priority 1, 2 or 3`)
    for (let c = s.col; c < s.col + s.span; c++) for (let r = s.row; r < s.row + s.rows; r++) {
      if (taken.has(`${c},${r}`)) fail(`slot ${s.id} overlaps another slot`)
      taken.add(`${c},${r}`)
    }
  }
  if (t.slots.filter(s => s.kind === 'imprint').length !== 1) fail(`${t.id} needs exactly one imprint slot`)
}

// buildPage(template, preset, { pageId, orgId }) -> { frames, objects }. Heights snap down to the baseline grid.
export function buildPage(template, preset, { pageId, orgId }) {
  assertTemplate(template, preset)
  const cols = columnBoxes(preset), { baseline, gutter } = preset.grid, top = cols[0].y, height = cols[0].h
  const snap = row => Math.floor(row / template.rows * height / baseline + 1e-9) * baseline
  const frames = [], objects = []
  for (const s of template.slots) {
    // One baseline of space below every slot that has a row under it, so neighbours never touch.
    const first = cols[s.col], last = cols[s.col + s.span - 1], y0 = snap(s.row)
    const y1 = snap(s.row + s.rows) - (s.row + s.rows < template.rows ? baseline : 0)
    if (y1 <= y0) fail(`slot ${s.id} has no height on this preset`)
    const box = { id: `${pageId}-${s.id}`, orgId, x: first.x, y: top + y0, w: last.x + last.w - first.x, h: y1 - y0 }
    if (s.kind === 'story') frames.push({ ...box, cols: s.span, gutter, slotId: s.id, priority: s.priority })
    else objects.push({ ...box, kind: KIND_TO_OBJECT[s.kind], z: 0, wrap: { mode: 'box', offset: { top: 0, right: 0, bottom: 0, left: 0 } }, style: { role: s.kind } })
  }
  return { frames, objects }
}

// One flow() frame per column of a story frame, in reading order.
export function frameColumns(frame) {
  const w = (frame.w - (frame.cols - 1) * frame.gutter) / frame.cols
  return Array.from({ length: frame.cols }, (_, i) => ({ id: `${frame.id}-c${i}`, x: frame.x + i * (w + frame.gutter), y: frame.y, w, h: frame.h }))
}

// The imprint a printed issue must carry (Press and Registration of Periodicals Act, 2023, s.3; not yet read by a lawyer).
// `assumed` names the fields that still hold a placeholder, the same way a preset does.
const IMPRINT_FIELDS = ['printer', 'placeOfPrinting', 'editor', 'publisher', 'placeOfPublication']
export function assertImprint(imprint) {
  for (const f of IMPRINT_FIELDS) if (typeof imprint?.[f] !== 'string' || !imprint[f].trim()) throw new Error(`bad imprint: no ${f}`)
  if (!Array.isArray(imprint.assumed)) throw new Error('bad imprint: assumed must be a list')
}
