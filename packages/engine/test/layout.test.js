import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { installFakeCanvas } from './helpers/fake-canvas.js'

installFakeCanvas()
const { pageLayout } = await import('../src/layout.js')
const { flow } = await import('../src/flow.js')
const { layoutHeadline } = await import('../src/headline.js')
const PX = 96 / 25.4
const preset = JSON.parse(fs.readFileSync(new URL('../../../presets/newspaper.json', import.meta.url)))
const ink = { top: 0.9, bottom: 0.35 }
const inks = { Fake: { 400: ink, 700: ink } }
const words = n => Array(n).fill('कखगघङचछजझञ').join(' ')
const wrap = { mode: 'box', offset: { top: 0, right: 0, bottom: 0, left: 0 } }
const style = { family: 'Fake', fontSize: 14, lineHeight: 20 }
const doc = {
  id: 'issue', orgId: 't', schemaVersion: 1, preset,
  stories: [{ id: 's-long', orgId: 't', body: [words(30)] }, { id: 's-fit', orgId: 't', body: [words(2)] }],
  pages: [{
    id: 'p1', no: 1, orgId: 't',
    frames: [
      { id: 'f1', orgId: 't', x: 10, y: 40, w: 77 / PX, h: 60 / PX, cols: 1, gutter: 0, style, storyId: 's-long' },
      { id: 'f2', orgId: 't', x: 60, y: 40, w: 77 / PX, h: 60 / PX, cols: 1, gutter: 0, style, storyId: 's-fit' },
      { id: 'f3', orgId: 't', x: 110, y: 40, w: 77 / PX, h: 60 / PX, cols: 1, gutter: 0, style },
    ],
    objects: [
      { id: 'head', orgId: 't', kind: 'label', x: 10, y: 10, w: 200 / PX, h: 25, z: 1, wrap, text: words(2), style: { family: 'Fake', weight: 700, sizes: [28, 20] } },
      { id: 'pic', orgId: 't', kind: 'photo', x: 150, y: 10, w: 40, h: 30, z: 0, wrap, src: 'data:image/png;base64,AAAA' },
      { id: 'rule', orgId: 't', kind: 'line', x: 10, y: 37, w: 180, h: 0.5, z: 0, wrap, style: { background: '#000000' } },
    ],
  }],
}

test('page size is the preset page in mm', () => {
  const l = pageLayout(doc, 'p1', { inks })
  assert.deepEqual([l.w, l.h], [preset.page.w, preset.page.h])
})

test('body lines are exactly what flow() sets, in px, and overflow does not throw', () => {
  const l = pageLayout(doc, 'p1', { inks })
  const f1 = l.frames.find(f => f.id === 'f1')
  const expected = flow(words(30), [{ id: 'f1', x: 10 * PX, y: 40 * PX, w: 77, h: 60, cols: 1, gutter: 0 }], [], { font: '400 14px "Fake"', lineHeight: 20 })
  assert.deepEqual(f1.lines.map(({ x, y, w, text }) => ({ x, y, w, text })), expected.lines.map(({ x, y, w, text }) => ({ x, y, w, text: text.trimEnd() })))
  assert.equal(f1.lines.length, 3)
  assert.equal(f1.font, '400 14px "Fake"')
  assert.equal(f1.lineHeight, 20)
  assert.equal(f1.storyId, 's-long')
})

test('the last line of a frame is not justified; others are', () => {
  const f2 = pageLayout(doc, 'p1', { inks }).frames.find(f => f.id === 'f2')
  assert.deepEqual(f2.lines.map(l => l.justify), [true, false])
})

test('an empty slot is kept with no lines, so the editor can mark and select it', () => {
  const f3 = pageLayout(doc, 'p1', { inks }).frames.find(f => f.id === 'f3')
  assert.equal(f3.storyId, null)
  assert.deepEqual(f3.lines, [])
  assert.deepEqual([f3.x, f3.y, f3.w, f3.h], [110 * PX, 40 * PX, 77, 60])
})

test('headlines come from layoutHeadline with the font ink', () => {
  const head = pageLayout(doc, 'p1', { inks }).labels.find(o => o.id === 'head')
  const want = layoutHeadline(words(2), { family: 'Fake', weight: 700, sizes: [28, 20], width: 200, height: 25 * PX, ink })
  assert.equal(head.size, want.size)
  assert.deepEqual(head.lines, want.lines)
  assert.equal(head.font, `700 ${want.size}px "Fake"`)
})

test('photos and rules are passed through as boxes in px', () => {
  const l = pageLayout(doc, 'p1', { inks })
  assert.deepEqual(l.photos, [{ id: 'pic', x: 150 * PX, y: 10 * PX, w: 40 * PX, h: 30 * PX, z: 0, src: 'data:image/png;base64,AAAA' }])
  assert.equal(l.boxes[0].id, 'rule')
  assert.equal(l.boxes[0].background, '#000000')
})

test('a shaped photo carries its outline, so the screen clips it as export does', () => {
  const shaped = structuredClone(doc), polygon = [[0, 0], [1, 0], [0.5, 1]]
  shaped.pages[0].objects[1].wrap = { mode: 'shape', polygon, offset: { top: 0, right: 0, bottom: 0, left: 0 } }
  assert.deepEqual(pageLayout(shaped, 'p1', { inks }).photos[0].polygon, polygon)
})

test('missing ink metrics for a headline font fail loudly', () => {
  assert.throws(() => pageLayout(doc, 'p1', { inks: {} }), /ink metrics missing for Fake 700/)
})

test('the document is not mutated', () => {
  const copy = structuredClone(doc)
  pageLayout(doc, 'p1', { inks })
  assert.deepEqual(doc, copy)
})
