// Document-type preset (D-039): page size, grid, page-count rule, export profile and asset packs are data on the document.
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { assertPreset, columnBoxes, pageCountAllowed } from '../src/preset.js'
import { assertDoc } from '../src/doc.js'

const newspaper = JSON.parse(fs.readFileSync(new URL('../../../presets/newspaper.json', import.meta.url), 'utf8'))

// Made-up document type: nothing in the engine may depend on the newspaper's numbers.
const other = {
  id: 'other', name: 'other', assumed: [],
  page: { w: 100, h: 150 }, margins: { top: 5, right: 6, bottom: 7, left: 8 },
  grid: { cols: 2, gutter: 2, baseline: 3 },
  pageCount: { multipleOf: 3 },
  exportProfile: { colourRoute: 'gray', pdfx: 'X', bleed: 1, cropMarks: false, iccProfile: 'x.icc', inkLimit: 200 },
  assetPacks: ['p'],
}
const change = (fn, base = other) => { const p = structuredClone(base); fn(p); return p }

test('the newspaper preset passes and says which values are assumed (GG-007)', () => {
  assert.doesNotThrow(() => assertPreset(newspaper))
  assert.equal(newspaper.id, 'newspaper')
  for (const field of ['page', 'margins', 'grid', 'pageCount']) assert.ok(newspaper.assumed.includes(field), field)
})

test('what the printer has not told us is empty, not guessed', () => {
  const e = newspaper.exportProfile
  for (const key of ['pdfx', 'bleed', 'cropMarks', 'iccProfile', 'inkLimit']) assert.equal(e[key], null, key)
})

test('columnBoxes follows the preset: margins, gutter and column count', () => {
  const boxes = columnBoxes(other)
  assert.deepEqual(boxes, [{ x: 8, y: 5, w: 42, h: 138 }, { x: 52, y: 5, w: 42, h: 138 }])
})

test('columnBoxes on the newspaper preset fills the width between the margins', () => {
  const boxes = columnBoxes(newspaper), { page, margins, grid } = newspaper
  assert.equal(boxes.length, grid.cols)
  assert.equal(boxes[0].x, margins.left)
  assert.ok(Math.abs(boxes.at(-1).x + boxes.at(-1).w - (page.w - margins.right)) < 1e-9)
  for (let i = 1; i < boxes.length; i++) assert.ok(Math.abs(boxes[i].x - boxes[i - 1].x - boxes[i - 1].w - grid.gutter) < 1e-9)
})

test('pageCountAllowed follows the preset rule', () => {
  assert.equal(pageCountAllowed(other, 6), true)
  assert.equal(pageCountAllowed(other, 7), false)
  assert.equal(pageCountAllowed(other, 0), false)
  assert.equal(pageCountAllowed(newspaper, newspaper.pageCount.multipleOf * 2), true)
})

test('assertPreset refuses a preset that cannot lay out a page', () => {
  const bad = {
    'no id': p => delete p.id,
    'zero width': p => { p.page.w = 0 },
    'text height': p => { p.page.h = '150' },
    'negative margin': p => { p.margins.left = -1 },
    'margins wider than the page': p => { p.margins.left = 60; p.margins.right = 60 },
    'margins taller than the page': p => { p.margins.top = 80; p.margins.bottom = 80 },
    'half a column': p => { p.grid.cols = 1.5 },
    'no columns': p => { p.grid.cols = 0 },
    'negative gutter': p => { p.grid.gutter = -1 },
    'gutters leave no column': p => { p.grid.gutter = 90 },
    'zero baseline': p => { p.grid.baseline = 0 },
    'zero page rule': p => { p.pageCount.multipleOf = 0 },
    'no export profile': p => delete p.exportProfile,
    'negative bleed': p => { p.exportProfile.bleed = -1 },
    'asset packs not a list': p => { p.assetPacks = 'p' },
    'assumed not a list': p => { p.assumed = 'page' },
  }
  for (const [name, fn] of Object.entries(bad)) assert.throws(() => assertPreset(change(fn)), /preset/, name)
})

test('a document must carry a valid preset', () => {
  const doc = { schemaVersion: 1, id: 'd', orgId: 'o', preset: other, stories: [], pages: [] }
  assert.doesNotThrow(() => assertDoc(doc))
  assert.throws(() => assertDoc({ ...doc, preset: undefined }), /preset/)
  assert.throws(() => assertDoc({ ...doc, preset: change(p => { p.grid.cols = 0 }) }), /preset/)
})
