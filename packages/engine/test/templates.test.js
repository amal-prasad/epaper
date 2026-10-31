// Weekly templates (Phase 1): JSON in templates/, in grid units, built against the document's preset (D-039).
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { installFakeCanvas } from './helpers/fake-canvas.js'
import { fuzzUndo, rng, pick, int } from './helpers/fuzz.js'
import { assertTemplate, buildPage, frameColumns, assertImprint } from '../src/templates.js'
import { apply } from '../src/ops.js'
import { assertDoc, SCHEMA_VERSION } from '../src/doc.js'
import { columnBoxes } from '../src/preset.js'

installFakeCanvas()
const { fit } = await import('../src/flow.js')

const read = rel => JSON.parse(fs.readFileSync(new URL(`../../../${rel}`, import.meta.url), 'utf8'))
const newspaper = read('presets/newspaper.json')
const NAMES = ['weekly-front', 'weekly-inner', 'weekly-ads']
const templates = Object.fromEntries(NAMES.map(n => [n, read(`templates/${n}.json`)]))
const janshakti = read('papers/janshakti.json')
// Made-up preset with the same column count: nothing may depend on the newspaper's sizes.
const other = { ...newspaper, id: 'other', page: { w: 210.5, h: 300.5 }, margins: { top: 9, right: 7, bottom: 11, left: 13 }, grid: { cols: 5, gutter: 3, baseline: 3.5 } }
const PRESETS = { newspaper, other }
const orgId = 'org1'
const EPS = 1e-6

const overlap = (a, b) => a.x < b.x + b.w - EPS && b.x < a.x + a.w - EPS && a.y < b.y + b.h - EPS && b.y < a.y + a.h - EPS
const build = (t, p) => buildPage(t, p, { pageId: 'p1', orgId })

for (const name of NAMES) for (const [pName, preset] of Object.entries(PRESETS)) {
  const where = `${name} on ${pName}`
  test(`${where}: every frame and object sits inside the margins`, () => {
    const { frames, objects } = build(templates[name], preset), m = preset.margins
    for (const b of [...frames, ...objects]) {
      assert.ok(b.x >= m.left - EPS && b.x + b.w <= preset.page.w - m.right + EPS, `${b.id} leaves the margins sideways`)
      assert.ok(b.y >= m.top - EPS && b.y + b.h <= preset.page.h - m.bottom + EPS, `${b.id} leaves the margins top or bottom`)
    }
  })
  test(`${where}: nothing overlaps`, () => {
    const { frames, objects } = build(templates[name], preset), all = [...frames, ...objects]
    for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++)
      assert.ok(!overlap(all[i], all[j]), `${all[i].id} overlaps ${all[j].id}`)
  })
  test(`${where}: a slot above another leaves at least one baseline of space`, () => {
    const { frames, objects } = build(templates[name], preset), all = [...frames, ...objects]
    for (const a of all) for (const b of all) {
      const sameColumn = a.x < b.x + b.w - EPS && b.x < a.x + a.w - EPS
      if (a !== b && sameColumn && b.y >= a.y + a.h - EPS)
        assert.ok(b.y - (a.y + a.h) >= preset.grid.baseline - EPS, `${a.id} touches ${b.id}`)
    }
  })
  test(`${where}: story frames start and end on the column grid and the baseline grid`, () => {
    const { frames } = build(templates[name], preset), cols = columnBoxes(preset)
    for (const f of frames) {
      assert.ok(cols.some(c => Math.abs(c.x - f.x) < EPS), `${f.id} does not start on a column`)
      assert.ok(cols.some(c => Math.abs(c.x + c.w - (f.x + f.w)) < EPS), `${f.id} does not end on a column`)
      for (const y of [f.y - preset.margins.top, f.h]) assert.ok(Math.abs(y / preset.grid.baseline - Math.round(y / preset.grid.baseline)) < 1e-6, `${f.id} is off the baseline`)
    }
  })
  test(`${where}: has the imprint, every record has orgId, and the result is deterministic`, () => {
    const page = build(templates[name], preset)
    assert.equal(page.objects.filter(o => o.style.role === 'imprint').length, 1)
    for (const r of [...page.frames, ...page.objects]) assert.equal(r.orgId, orgId)
    assert.deepEqual(build(templates[name], preset), page)
  })
  test(`${where}: story frames take real text through flow and fit`, () => {
    const { frames } = build(templates[name], preset), lineHeight = 4
    assert.ok(frames.length > 0)
    for (const f of frames) {
      const columns = frameColumns(f)
      assert.equal(columns.length, f.cols)
      const r = fit('कखग घङच '.repeat(4000), columns, [], { font: '10px "Fake"', lineHeight })
      assert.ok(r.lines > 0, `${f.id} takes no text`)
      assert.ok(r.overflowLines > 0)
    }
  })
}

test('the three templates are what the plan asks for', () => {
  const stories = t => t.slots.filter(s => s.kind === 'story')
  const front = templates['weekly-front'], inner = templates['weekly-inner'], ads = templates['weekly-ads']
  assert.ok(front.slots.some(s => s.kind === 'masthead'), 'the front page has a masthead')
  assert.ok(stories(front).some(s => s.priority === 1), 'the front page has a lead')
  assert.ok(stories(front).some(s => s.priority === 2), 'the front page has a secondary')
  assert.ok(stories(inner).length >= 3, 'an inner page takes several stories')
  assert.ok(ads.slots.filter(s => s.kind === 'ad').length >= 4, 'the ads page has ad slots')
  for (const t of [front, inner, ads]) assert.ok(t.slots.some(s => s.kind === 'imprint'), `${t.id} has no imprint slot`)
})

test('templates hold grid units, never millimetres', () => {
  for (const t of Object.values(templates)) for (const s of t.slots) {
    for (const k of ['x', 'y', 'w', 'h', 'mm']) assert.equal(k in s, false, `${t.id} slot ${s.id} has ${k}`)
    for (const k of ['col', 'span', 'row', 'rows']) assert.ok(Number.isInteger(s[k]), `${t.id} slot ${s.id}: ${k}`)
  }
})

test('assertTemplate refuses a template that does not fit its grid', () => {
  const t = templates['weekly-front']
  const change = fn => { const c = structuredClone(t); fn(c); return c }
  const bad = {
    'wrong column count for the preset': c => { c.columns = 6 },
    'slot past the last column': c => { c.slots[0].col = 4; c.slots[0].span = 3 },
    'slot past the last row': c => { c.slots[0].row = c.rows - 1; c.slots[0].rows = 5 },
    'half a column': c => { c.slots[0].span = 1.5 },
    'no rows': c => { c.slots[0].rows = 0 },
    'unknown kind': c => { c.slots[0].kind = 'poster' },
    'two slots with one id': c => { c.slots[1].id = c.slots[0].id },
    'two slots in one place': c => { c.slots[1] = { ...c.slots[0], id: 'copy' } },
    'story with no priority': c => { const s = c.slots.find(x => x.kind === 'story'); delete s.priority },
    'no imprint': c => { c.slots = c.slots.filter(s => s.kind !== 'imprint') },
    'no id': c => { delete c.id },
  }
  assert.doesNotThrow(() => assertTemplate(t, newspaper))
  for (const [name, fn] of Object.entries(bad)) assert.throws(() => assertTemplate(change(fn), newspaper), /template/, name)
})

test('the Janshakti imprint has all five fields, and placeholders are marked as assumed', () => {
  assert.doesNotThrow(() => assertImprint(janshakti.imprint))
  const fields = ['printer', 'placeOfPrinting', 'editor', 'publisher', 'placeOfPublication']
  for (const f of fields) assert.ok(janshakti.imprint[f], f)
  assert.deepEqual([...janshakti.imprint.assumed].sort(), [...fields].sort(), 'every field is a placeholder until Amal gives the real one')
  assert.throws(() => assertImprint({ ...janshakti.imprint, editor: '' }), /imprint/)
  assert.throws(() => assertImprint({ ...janshakti.imprint, assumed: 'editor' }), /imprint/)
})

// ---- applyTemplate as an op

function makeDoc(r = rng(1)) {
  const stories = ['s1', 's2', 's3'].map(id => ({ id, orgId, headline: id, body: [], assetIds: [] }))
  const pages = [0, 1, 2].map(p => ({ id: `p${p}`, orgId, no: p + 1, frames: [], objects: [] }))
  let doc = { schemaVersion: SCHEMA_VERSION, id: 'issue1', orgId, preset: newspaper, imprint: janshakti.imprint, stories, pages }
  if (r() < 0.8) doc = apply(doc, { type: 'applyTemplate', args: { pageId: 'p0', template: templates['weekly-front'] } }).doc
  return doc
}
const GENS = {
  applyTemplate: (r, doc) => ({ pageId: pick(r, doc.pages).id, template: templates[pick(r, NAMES)] }),
  placeStory(r, doc) {
    const fs = doc.pages.flatMap(p => p.frames)
    if (!fs.length) return null
    const free = doc.stories.filter(s => !fs.some(f => f.storyId === s.id))
    return { frameId: pick(r, fs).id, storyId: free.length && r() < 0.7 ? pick(r, free).id : null }
  },
  removeBlock(r, doc) {
    const all = doc.pages.flatMap(p => p.objects)
    return all.length ? { objectId: pick(r, all).id } : null
  },
}
const fuzzOps = applyFn => Object.keys(GENS).map(name => ({
  name,
  gen: GENS[name],
  apply(doc, args) {
    const out = applyFn(doc, { type: name, args })
    assertDoc(out.doc)
    const inverse = JSON.parse(JSON.stringify(out.inverse))
    return { doc: out.doc, inverse: d => applyFn(d, inverse).doc }
  },
}))

test('applyTemplate passes fuzzUndo alongside other ops', () => {
  fuzzUndo({ makeDoc, ops: fuzzOps(apply) })
})

test('applyTemplate lays out the page from the document\'s preset, and records the template', () => {
  const doc = makeDoc(rng(2)), page = apply(doc, { type: 'applyTemplate', args: { pageId: 'p1', template: templates['weekly-inner'] } }).doc.pages[1]
  assert.equal(page.templateId, 'weekly-inner')
  assert.deepEqual(page.frames, build(templates['weekly-inner'], newspaper).frames)
})

test('applyTemplate clears what was on the page, and undo brings placed stories back', () => {
  let doc = makeDoc(rng(2))
  const frontFrame = doc.pages[0].frames[0].id
  doc = apply(doc, { type: 'placeStory', args: { frameId: frontFrame, storyId: 's1' } }).doc
  const { doc: out, inverse } = apply(doc, { type: 'applyTemplate', args: { pageId: 'p0', template: templates['weekly-ads'] } })
  assert.equal(out.pages[0].frames.some(f => f.storyId), false)
  assert.deepEqual(apply(out, JSON.parse(JSON.stringify(inverse))).doc, doc)
})

test('applyTemplate refuses a template for another grid and an unknown page, and changes nothing', () => {
  const doc = makeDoc(rng(2))
  assert.throws(() => apply(doc, { type: 'applyTemplate', args: { pageId: 'p1', template: { ...templates['weekly-inner'], columns: 6 } } }), /template/)
  assert.throws(() => apply(doc, { type: 'applyTemplate', args: { pageId: 'nope', template: templates['weekly-inner'] } }), /no page/)
})

test('a document with a bad imprint is refused', () => {
  const doc = makeDoc(rng(3))
  assert.doesNotThrow(() => assertDoc(doc))
  assert.throws(() => assertDoc({ ...doc, imprint: { printer: 'x' } }), /imprint/)
})

// Mutation check: the real ops.js with applyTemplate's inverse broken; the fuzz must fail.
test('mutation check, fuzz fails when applyTemplate\'s inverse forgets the old page', async () => {
  const source = fs.readFileSync(new URL('../src/ops.js', import.meta.url), 'utf8')
  const from = "inverse: { type: 'restorePage', args: { pageId, page: old } }", to = "inverse: { type: 'restorePage', args: { pageId, page: { ...old, frames: [] } } }"
  assert.equal(source.split(from).length, 2, 'mutation target must appear exactly once in ops.js')
  const src = source.replace(from, to).replace(/from '\.\//g, `from '${new URL('../src/', import.meta.url).href}`)
  const mutated = await import('data:text/javascript;base64,' + Buffer.from(src).toString('base64'))
  assert.throws(() => fuzzUndo({ makeDoc, ops: fuzzOps(mutated.apply) }), /fuzz seed \d+/)
})

test('fuzz helpers reach every op', () => {
  const r = rng(9), seen = new Set()
  let doc = makeDoc(r)
  for (let i = 0; i < 200; i++) {
    const name = pick(r, Object.keys(GENS)), args = GENS[name](r, doc)
    if (!args) continue
    seen.add(name)
    doc = apply(doc, { type: name, args }).doc
    if (int(r, 0, 9) === 0) doc = makeDoc(r)
  }
  assert.equal(seen.size, 3)
})
