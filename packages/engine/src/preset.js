// A document type is data (D-039). It sets page size, grid, page-count rule, export profile and asset packs, and the
// document carries its own copy, so an old issue keeps its numbers when a preset file changes. Values live in presets/*.json.
//   { id, name, assumed: string[], page: { w, h }, margins: { top, right, bottom, left }, grid: { cols, gutter, baseline },
//     pageCount: { multipleOf }, exportProfile: { colourRoute, pdfx, bleed, cropMarks, iccProfile, inkLimit }, assetPacks: string[] }
// `assumed` names the fields not yet confirmed by the printer. A null in exportProfile means not known yet. All lengths in mm.

const fail = message => { throw new Error(`bad preset: ${message}`) }
const isNum = v => Number.isFinite(v)

const columnWidth = ({ page, margins, grid }) =>
  (page.w - margins.left - margins.right - (grid.cols - 1) * grid.gutter) / grid.cols

export function assertPreset(p) {
  if (!p || typeof p !== 'object') fail('missing')
  if (!p.id) fail('no id')
  if (!Array.isArray(p.assumed)) fail('assumed must be a list')
  if (!Array.isArray(p.assetPacks)) fail('assetPacks must be a list')
  if (!(isNum(p.page?.w) && p.page.w > 0 && isNum(p.page.h) && p.page.h > 0)) fail('page size must be above 0')
  for (const side of ['top', 'right', 'bottom', 'left'])
    if (!(isNum(p.margins?.[side]) && p.margins[side] >= 0)) fail(`margin ${side} must be 0 or more`)
  if (!(Number.isInteger(p.grid?.cols) && p.grid.cols >= 1)) fail('cols must be a whole number from 1')
  if (!(isNum(p.grid.gutter) && p.grid.gutter >= 0)) fail('gutter must be 0 or more')
  if (!(isNum(p.grid.baseline) && p.grid.baseline > 0)) fail('baseline must be above 0')
  if (columnWidth(p) <= 0) fail('margins and gutters leave no column width')
  if (p.page.h - p.margins.top - p.margins.bottom <= 0) fail('margins leave no column height')
  if (!(Number.isInteger(p.pageCount?.multipleOf) && p.pageCount.multipleOf >= 1)) fail('pageCount.multipleOf must be a whole number from 1')
  if (!p.exportProfile || typeof p.exportProfile !== 'object') fail('no exportProfile')
  const { bleed } = p.exportProfile
  if (bleed != null && !(isNum(bleed) && bleed >= 0)) fail('bleed must be 0 or more')
}

// One box per grid column, in mm from the top-left of the trim box.
export function columnBoxes(preset) {
  const { margins, grid, page } = preset
  const w = columnWidth(preset), h = page.h - margins.top - margins.bottom
  return Array.from({ length: grid.cols }, (_, i) => ({ x: margins.left + i * (w + grid.gutter), y: margins.top, w, h }))
}

export const pageCountAllowed = (preset, n) => Number.isInteger(n) && n > 0 && n % preset.pageCount.multipleOf === 0
