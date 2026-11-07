import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { installFakeCanvas } from './helpers/fake-canvas.js'

installFakeCanvas()
const { pageMarks, issueProblems } = await import('../src/marks.js')
const { fit } = await import('../src/flow.js')
const PX = 96 / 25.4
const preset = JSON.parse(fs.readFileSync(new URL('../../../presets/newspaper.json', import.meta.url)))
const words = n => Array(n).fill('कखगघङचछजझञ').join(' ')
const story = (id, n) => ({ id, orgId: 'test', body: [words(n)] })
const style = { family: 'Fake', fontSize: 14, lineHeight: 20 }
const frame = (id, lines, storyId) => ({ id, orgId: 'test', x: 0, y: 0, w: 77 / PX, h: lines * 20 / PX, cols: 1, gutter: 0, style,
  ...(storyId ? { storyId } : {}) })
const doc = {
  id: 'issue', orgId: 'test', schemaVersion: 1, preset,
  stories: [story('long', 9), story('short', 2), story('exact', 3)],
  pages: [
    { id: 'p1', no: 1, orgId: 'test', objects: [], frames: [frame('f-over', 2, 'long'), frame('f-empty', 4, 'short'), frame('f-none', 3)] },
    { id: 'p2', no: 2, orgId: 'test', objects: [], frames: [frame('f-ok', 3, 'exact')] },
  ],
}
const byId = marks => Object.fromEntries(marks.map(m => [m.frameId, m]))
const direct = (s, lines) => fit(words(s), [{ x: 0, y: 0, w: 77, h: lines * 20 }], [], { font: '400 14px "Fake"', lineHeight: 20 })

test('each slot gets over, empty, ok or unfilled with line counts from fit()', () => {
  const m = byId(pageMarks(doc, 'p1'))
  assert.deepEqual(m['f-over'], { frameId: 'f-over', storyId: 'long', state: 'over', overLines: direct(9, 2).overflowLines, emptyLines: 0 })
  assert.ok(m['f-over'].overLines > 0)
  assert.deepEqual(m['f-empty'], { frameId: 'f-empty', storyId: 'short', state: 'empty', overLines: 0, emptyLines: direct(2, 4).underfillLines })
  assert.ok(m['f-empty'].emptyLines > 0)
  assert.deepEqual(m['f-none'], { frameId: 'f-none', storyId: null, state: 'unfilled', overLines: 0, emptyLines: 0 })
  assert.deepEqual(byId(pageMarks(doc, 'p2'))['f-ok'], { frameId: 'f-ok', storyId: 'exact', state: 'ok', overLines: 0, emptyLines: 0 })
})

test('any single empty line is marked empty (D-083: no threshold)', () => {
  const one = structuredClone(doc)
  one.pages[1].frames[0].h = 4 * 20 / PX
  const m = pageMarks(one, 'p2')[0]
  assert.equal(m.state, 'empty')
  assert.equal(m.emptyLines, 1)
})

test('marks expose line counts only, never a percentage (D-080)', () => {
  for (const m of pageMarks(doc, 'p1')) assert.deepEqual(Object.keys(m).sort(), ['emptyLines', 'frameId', 'overLines', 'state', 'storyId'])
})

test('issueProblems lists every slot that is not ok, in page order, and does not mutate the document', () => {
  const copy = structuredClone(doc)
  assert.deepEqual(issueProblems(doc).map(p => [p.pageId, p.frameId, p.state]),
    [['p1', 'f-over', 'over'], ['p1', 'f-empty', 'empty'], ['p1', 'f-none', 'unfilled']])
  assert.deepEqual(doc, copy)
})

test('an unknown page fails loudly', () => {
  assert.throws(() => pageMarks(doc, 'nope'), /no page nope/)
})
