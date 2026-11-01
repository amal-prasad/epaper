// A template is data (templates/*.json) in grid units, so it holds no sizes: a slot is col, span, row and rows on a grid of
// `columns` columns and `rows` rows. buildPage turns it into frames and objects using the document's preset (D-039).
//   { id, name, columns, rows, slots: [{ id, kind, col, span, row, rows, ... }] }
//   kind: story, photo, hero, cutout, masthead, ear, strip, folio, section, quote, imprint, ad
//   a story slot also has: priority 1-3, textCols, head: { kicker, headline, byline } in baselines, boxed? (a tinted panel), and
//     inset?: { side: 'left'|'right'|'center', place?: 'top'|'middle', width: fraction of the text width, rows: baselines,
//               caption: baselines, shape?: 'box'|'round'|'cutout' }
//   a hero slot may have label: true, the section name set on the photo
import { columnBoxes } from './preset.js'
import { roundPolygon } from './wrap.js'

const KIND_TO_OBJECT = { photo: 'photo', hero: 'photo', cutout: 'photo', ear: 'photo', masthead: 'label', strip: 'label', folio: 'label', section: 'label', quote: 'quote', imprint: 'label', ad: 'ad' }
const HEAD_PARTS = ['kicker', 'headline', 'byline']
// Stand-in outline for a cut-out until a real image brings its own (D-035: extracted at upload, stored as data): head and shoulders.
export const FIGURE_POLYGON = [[0.32, 0.14], [0.4, 0.04], [0.6, 0.04], [0.68, 0.14], [0.68, 0.28], [0.6, 0.36], [0.84, 0.44], [1, 0.58], [1, 1], [0, 1], [0, 0.58], [0.16, 0.44], [0.4, 0.36], [0.32, 0.28]]
const shapePolygon = shape => (shape === 'round' ? roundPolygon() : shape === 'cutout' ? FIGURE_POLYGON : undefined)
const fail = message => { throw new Error(`bad template: ${message}`) }
const whole = (v, min) => Number.isInteger(v) && v >= min

function assertStorySlot(s) {
  if (![1, 2, 3].includes(s.priority)) fail(`story slot ${s.id} needs priority 1, 2 or 3`)
  if (!(whole(s.textCols, 1) && s.textCols <= s.span)) fail(`story slot ${s.id} needs textCols from 1 to its span`)
  for (const part of HEAD_PARTS) if (!whole(s.head?.[part], 0)) fail(`story slot ${s.id} needs a whole number of baselines for ${part}`)
  if (s.inset === undefined) return
  const { side, place = 'top', shape = 'box', width, rows, caption } = s.inset
  if (!['left', 'right', 'center'].includes(side)) fail(`story slot ${s.id} has inset side ${side}`)
  if (!['top', 'middle'].includes(place)) fail(`story slot ${s.id} has inset place ${place}`)
  if (!['box', 'round', 'cutout'].includes(shape)) fail(`story slot ${s.id} has inset shape ${shape}`)
  if (!(width > 0 && width <= 1)) fail(`story slot ${s.id} has inset width ${width}`)
  if (!(whole(rows, 1) && whole(caption, 0))) fail(`story slot ${s.id} needs whole baselines for its inset and caption`)
}

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
    if (s.kind === 'story') assertStorySlot(s)
    for (let c = s.col; c < s.col + s.span; c++) for (let r = s.row; r < s.row + s.rows; r++) {
      if (taken.has(`${c},${r}`)) fail(`slot ${s.id} overlaps another slot`)
      taken.add(`${c},${r}`)
    }
  }
  if (t.slots.filter(s => s.kind === 'imprint').length > 1) fail(`${t.id} has more than one print line`)
}

const NO_WRAP = { mode: 'none', offset: { top: 0, right: 0, bottom: 0, left: 0 } }

// Kicker, headline and byline above the text, the text frame, and any photo and caption set into it.
function buildStory(s, box, { baseline, gutter }) {
  const objects = []
  let y = box.y
  const part = (name, h, kind = 'label') => { const o = { ...box, id: `${box.id}-${name}`, slotId: s.id, y, h, kind, z: 0, wrap: NO_WRAP, style: { role: name } }; return o }
  for (const name of HEAD_PARTS) {
    const h = s.head[name] * baseline
    if (h > 0) objects.push(part(name, h))
    y += h
  }
  const h = box.y + box.h - y
  if (h <= 0) fail(`story slot ${s.id} has no room for text on this preset`)
  const frame = { ...box, y, h, cols: s.textCols, gutter, slotId: s.id, priority: s.priority, ...(s.boxed ? { boxed: true } : {}) }
  if (s.inset) {
    const { side, place = 'top', shape = 'box', width, rows, caption } = s.inset
    const w = box.w * width, photoH = rows * baseline, captionH = caption * baseline
    if (photoH + captionH > h) fail(`story slot ${s.id} has a photo taller than its text on this preset`)
    const x = side === 'left' ? box.x : side === 'right' ? box.x + box.w - w : box.x + (box.w - w) / 2
    const free = Math.floor((h - photoH - captionH) / baseline / 2 + 1e-9) * baseline
    const top = place === 'middle' ? y + free : y
    const offset = { top: place === 'middle' ? baseline : 0, right: side === 'right' ? 0 : gutter, bottom: 0, left: side === 'left' ? 0 : gutter }
    const set = (name, kind, yy, hh, bottom, polygon) => ({
      id: `${box.id}-${name}`, orgId: box.orgId, slotId: s.id, frameId: box.id, x, y: yy, w, h: hh, kind, z: 1,
      wrap: { mode: polygon ? 'shape' : 'box', offset: { ...offset, bottom }, ...(polygon ? { polygon } : {}) }, style: { role: name },
    })
    objects.push(set('inset', 'photo', top, photoH, caption ? 0 : baseline, shapePolygon(shape)))
    if (caption) objects.push(set('caption', 'label', top + photoH, captionH, baseline))
  }
  return { frame, objects }
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
    if (s.kind === 'story') {
      const built = buildStory(s, box, { baseline, gutter })
      frames.push(built.frame); objects.push(...built.objects)
    } else {
      const polygon = s.kind === 'cutout' ? FIGURE_POLYGON : undefined
      objects.push({ ...box, slotId: s.id, kind: KIND_TO_OBJECT[s.kind], z: 0, wrap: { mode: polygon ? 'shape' : 'box', offset: { top: 0, right: 0, bottom: 0, left: 0 }, ...(polygon ? { polygon } : {}) }, style: { role: s.kind } })
      // The section name sits on the photo, so it overlaps its own slot on purpose.
      if (s.label) objects.push({ id: `${box.id}-label`, orgId, slotId: s.id, overlay: true, x: box.x, y: box.y, w: box.w / 3, h: 2 * baseline, kind: 'label', z: 1, wrap: NO_WRAP, style: { role: 'sectionLabel' } })
    }
  }
  return { frames, objects }
}

// One flow() frame per text column of a story frame, in reading order.
export function frameColumns(frame) {
  const w = (frame.w - (frame.cols - 1) * frame.gutter) / frame.cols
  return Array.from({ length: frame.cols }, (_, i) => ({ id: `${frame.id}-c${i}`, x: frame.x + i * (w + frame.gutter), y: frame.y, w, h: frame.h }))
}

// The print line (Press and Registration of Periodicals Act, 2023, s.3; not yet read by a lawyer). Fields follow the printed
// page. Entered once, in publication settings (papers/*.json); pages only say where it goes. `assumed` names the placeholders.
const IMPRINT_FIELDS = ['owner', 'printer', 'placeOfPrinting', 'publisher', 'placeOfPublication', 'editor', 'registrationNo', 'mobile', 'email', 'jurisdiction']
export function assertImprint(imprint) {
  for (const f of IMPRINT_FIELDS) if (typeof imprint?.[f] !== 'string' || !imprint[f].trim()) throw new Error(`bad imprint: no ${f}`)
  if (!Array.isArray(imprint.assumed)) throw new Error('bad imprint: assumed must be a list')
}

// Only the last page carries the print line, so the check belongs to the issue, not to a template. Export must use it (GG-065).
export const issueHasPrintLine = doc => doc.pages.some(p => p.objects.some(o => o.style?.role === 'imprint'))
