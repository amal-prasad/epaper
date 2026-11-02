import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { installFakeCanvas } from './helpers/fake-canvas.js'
import { fuzzUndo, int } from './helpers/fuzz.js'
import { apply, run, startHistory, undo } from '../src/ops.js'

installFakeCanvas()
const { autopage } = await import('../src/autopage.js')
const PX = 96 / 25.4
const preset = JSON.parse(fs.readFileSync(new URL('../../../presets/newspaper.json', import.meta.url)))
const words = n => Array(n).fill('कखगघङचछजझञ').join(' ')
const story = (id, n = 2, priority = 2) => ({ id, orgId: 'test', priority, body: [words(n)] })
const frame = (id, n = 3, priority = 2, extra = {}) => ({ id, orgId: 'test', x: 0, y: 0, w: 77 / PX, h: n * 20 / PX,
  cols: 1, gutter: 0, priority, style: { family: 'Fake', fontSize: 14, lineHeight: 20 }, ...extra })
const makeDoc = (stories = [story('b'), story('a')], frames = [frame('z'), frame('a')]) => ({ id: 'issue', orgId: 'test', schemaVersion: 1,
  preset, stories, pages: [{ id: 'p1', no: 1, orgId: 'test', frames, objects: [] }] })
const freeze = o => { Object.freeze(o); Object.values(o).forEach(v => { if (v && typeof v === 'object' && !Object.isFrozen(v)) freeze(v) }); return o }

test('priority then IDs break ties independent of story/frame array ordering', () => {
  const doc = makeDoc([story('c', 2, 3), story('b', 2, 1), story('a', 2, 1)], [frame('z', 3, 3), frame('b', 3, 1), frame('a', 3, 1)])
  const proposal = autopage({ doc })
  assert.deepEqual(proposal.placements.map(p => [p.storyId, p.frameId]), [['a', 'a'], ['b', 'b'], ['c', 'z']])
  const reversed = structuredClone(doc)
  reversed.stories.reverse(); reversed.pages[0].frames.reverse()
  assert.deepEqual(autopage({ doc: reversed }).placements, proposal.placements)
  assert.deepEqual(autopage({ doc }).ops, proposal.ops)
})

test('frozen inputs remain unchanged and every accepted action replays and undoes', () => {
  const doc = freeze(structuredClone(makeDoc())), copy = structuredClone(doc), result = autopage({ doc })
  let history = startHistory(doc)
  for (const op of result.ops) history = run(history, op)
  assert.deepEqual(history.doc, result.doc)
  for (const op of result.ops) history = undo(history)
  assert.deepEqual(history.doc, copy)
  assert.deepEqual(result.inverses.reduce((d, op) => apply(d, op).doc, result.doc), copy)
  assert.deepEqual(doc, copy)
  assert.equal(result.changes.length, result.ops.length)
})

test('existing and locked empty placements remain byte-for-byte unchanged', () => {
  const doc = makeDoc([story('old', 9), story('new')], [frame('old-frame', 2, 2, { storyId: 'old' }), frame('reserved'), frame('free')])
  const result = autopage({ doc, locks: ['old-frame', 'reserved'] })
  assert.deepEqual(result.doc.pages[0].frames.slice(0, 2), doc.pages[0].frames.slice(0, 2))
  assert.equal(result.doc.pages[0].frames[2].storyId, 'new')
  assert.equal(result.unresolvedOverflow.length, 1)
  assert.equal(result.unresolvedOverflow[0].storyId, 'old')
  assert.equal(result.placements.find(p => p.storyId === 'old').locked, true)
  assert.equal(result.placements.find(p => p.storyId === 'old').existing, true)
})

test('tries the next fitting slot and leaves oversized copy unplaced and intact', () => {
  const doc = makeDoc([story('lead', 4, 1), story('long', 20), story('small', 1)], [frame('small', 2, 1), frame('large', 5, 2)])
  const result = autopage({ doc })
  assert.equal(result.placements.find(p => p.storyId === 'lead').frameId, 'large')
  assert.equal(result.placements.find(p => p.storyId === 'small').frameId, 'small')
  assert.deepEqual(result.unplaced.map(s => [s.storyId, s.reason]), [['long', 'overflow']])
  assert.ok(result.unplaced[0].bestFit.overflowLines > 0)
  assert.deepEqual(result.doc.stories, doc.stories)
  assert.ok(result.doc.pages.every(p => p.frames.every(f => f.nextFrameId === undefined)))
})

test('page objects and frame-specific obstacles count toward fit', () => {
  const doc = makeDoc([story('a', 3)], [frame('a', 3)])
  doc.pages[0].objects = [{ id: 'photo', orgId: 'test', kind: 'photo', frameId: 'a', x: 0, y: 20 / PX, w: 77 / PX, h: 20 / PX,
    wrap: { mode: 'box', offset: {} } }]
  const result = autopage({ doc })
  assert.equal(result.unplaced[0].reason, 'overflow')
  assert.equal(result.unplaced[0].bestFit.capacity, 2)
  assert.equal(result.unplaced[0].bestFit.overflowLines, 1)
  assert.equal(result.ops.length, 0)
})

test('empty eligible slots, exhausted work budget and unknown locks are explicit', () => {
  assert.equal(autopage({ doc: makeDoc([story('a')], []) }).unplaced[0].reason, 'no-slot')
  const result = autopage({ doc: makeDoc([story('a', 9), story('b')]), maxFitChecks: 1 })
  assert.equal(result.fitChecks, 1)
  assert.equal(result.unplaced[0].reason, 'budget-exhausted')
  assert.equal(result.unplaced[1].reason, 'budget-exhausted')
  assert.throws(() => autopage({ doc: makeDoc(), locks: ['missing'] }), /unknown locked frame/)
  assert.throws(() => autopage({ doc: makeDoc(), pageLocks: ['missing'] }), /unknown locked page/)
})

test('page locks preserve empty slots and page/frame lock flags are honored', () => {
  const doc = makeDoc([story('a')], [frame('reserved', 3, 1, { locked: true }), frame('free')])
  assert.equal(autopage({ doc }).placements[0].frameId, 'free')
  assert.equal(autopage({ doc, pageLocks: ['p1'] }).unplaced[0].reason, 'no-slot')
  doc.pages[0].locked = true
  assert.equal(autopage({ doc }).ops.length, 0)
})

test('page number order precedes page/frame IDs after slot priority', () => {
  const doc = makeDoc([story('a'), story('b')], [frame('a')])
  doc.pages[0].no = 2
  doc.pages.push({ id: 'z', no: 1, orgId: 'test', frames: [frame('z')], objects: [] })
  assert.deepEqual(autopage({ doc }).placements.map(p => [p.storyId, p.pageId]), [['a', 'z'], ['b', 'p1']])
})

test('builds template slots using an existing reversible op only on empty pages', () => {
  const template = { id: 'test-template', columns: preset.grid.cols, rows: 10, slots: [{ id: 'lead', kind: 'story', priority: 1,
    col: 0, span: 2, row: 0, rows: 10, textCols: 1, head: { kicker: 0, headline: 0, byline: 0 } }] }
  const doc = makeDoc([story('a', 1)], [])
  const result = autopage({ doc, templates: { p1: template } })
  assert.equal(result.ops[0].type, 'applyTemplate')
  assert.equal(result.placements[0].frameId, 'p1-lead')
  assert.deepEqual(result.inverses.reduce((d, op) => apply(d, op).doc, result.doc), doc)
  assert.throws(() => autopage({ doc: makeDoc(), templates: { p1: template } }), /empty page/)
  const withFurniture = makeDoc([], [])
  withFurniture.pages[0].objects = [{ id: 'furniture', orgId: 'test', kind: 'box', x: 0, y: 0, w: 1, h: 1, wrap: { mode: 'none', offset: {} } }]
  assert.throws(() => autopage({ doc: withFurniture, templates: { p1: template } }), /empty page/)
})

test('refuses chains, duplicate IDs and unsupported copy instead of silently losing content', () => {
  assert.throws(() => autopage({ doc: makeDoc([], [frame('a', 2, 2, { nextFrameId: 'b' }), frame('b')]) }), /continuation/)
  assert.throws(() => autopage({ doc: makeDoc([story('a'), story('a')]) }), /duplicate story/)
  assert.throws(() => autopage({ doc: makeDoc([{ id: 'a', orgId: 'test', body: [{ text: 'copy' }] }]) }), /plain paragraphs/)
  const rotated = makeDoc()
  rotated.pages[0].objects = [{ id: 'rotated', orgId: 'test', kind: 'photo', x: 0, y: 0, w: 1, h: 1, rot: 10,
    wrap: { mode: 'box', offset: {} } }]
  assert.throws(() => autopage({ doc: rotated }), /rotated object/)
  assert.deepEqual(autopage({ doc: makeDoc([{ id: 'a', orgId: 'test', body: ['  '] }]) }).unplaced,
    [{ storyId: 'a', reason: 'empty-copy' }])
})

test('fuzzUndo restores exact inputs after seeded auto-page proposals', () => {
  fuzzUndo({ runs: 80, steps: 5,
    makeDoc: r => makeDoc(Array.from({ length: int(r, 1, 8) }, (_, i) => story(`s${i}`, int(r, 1, 15), int(r, 1, 3))),
      Array.from({ length: int(r, 1, 6) }, (_, i) => frame(`f${i}`, int(r, 1, 8), int(r, 1, 3)))),
    ops: [{ name: 'auto-page proposal', gen: () => ({}), apply: doc => {
      const result = autopage({ doc })
      return { doc: result.doc, inverse: d => result.inverses.reduce((out, op) => apply(out, op).doc, d) }
    } }],
  })
})
