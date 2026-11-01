// Weekly templates (Phase 1), rebuilt from Janshakti's printed pages (D-058): JSON in templates/, in grid units, built
// against the document's preset (D-039). A story slot holds a kicker, headline and byline above its text, and can hold a photo
// set into the text. The print line sits on the last page only.
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { installFakeCanvas } from './helpers/fake-canvas.js'
import { fuzzUndo, rng, pick, int } from './helpers/fuzz.js'
import { assertTemplate, buildPage, frameColumns, assertImprint, issueHasPrintLine } from '../src/templates.js'
import { apply } from '../src/ops.js'
import { assertDoc, SCHEMA_VERSION } from '../src/doc.js'
import { columnBoxes } from '../src/preset.js'
import { wrapObstacles } from '../src/wrap.js'

installFakeCanvas()
const { fit, flow } = await import('../src/flow.js')

const read = rel => JSON.parse(fs.readFileSync(new URL(`../../../${rel}`, import.meta.url), 'utf8'))
const newspaper = read('presets/newspaper.json')
const NAMES = fs.readdirSync(new URL('../../../templates/', import.meta.url)).filter(f => f.endsWith('.json')).map(f => f.replace('.json', '')).sort()
const templates = Object.fromEntries(NAMES.map(n => [n, read(`templates/${n}.json`)]))
const janshakti = read('papers/janshakti.json')
// Made-up preset with the same column count: nothing may depend on the newspaper's sizes.
const other = { ...newspaper, id: 'other', page: { w: 210.5, h: 300.5 }, margins: { top: 9, right: 7, bottom: 11, left: 13 }, grid: { cols: newspaper.grid.cols, gutter: 3, baseline: 3.5 } }
const PRESETS = { newspaper, other }
const orgId = 'org1'
const EPS = 1e-6

const overlap = (a, b) => a.x < b.x + b.w - EPS && b.x < a.x + a.w - EPS && a.y < b.y + b.h - EPS && b.y < a.y + a.h - EPS
const build = (t, p) => buildPage(t, p, { pageId: 'p1', orgId })
const insideStory = o => o.frameId !== undefined || o.overlay === true     // set into a story's text, or onto a photo, on purpose

for (const name of NAMES) for (const [pName, preset] of Object.entries(PRESETS)) {
  const where = `${name} on ${pName}`
  test(`${where}: every frame and object sits inside the margins`, () => {
    const { frames, objects } = build(templates[name], preset), m = preset.margins
    for (const b of [...frames, ...objects]) {
      assert.ok(b.x >= m.left - EPS && b.x + b.w <= preset.page.w - m.right + EPS, `${b.id} leaves the margins sideways`)
      assert.ok(b.y >= m.top - EPS && b.y + b.h <= preset.page.h - m.bottom + EPS, `${b.id} leaves the margins top or bottom`)
    }
  })
  test(`${where}: nothing overlaps, except a photo set into its own story`, () => {
    const { frames, objects } = build(templates[name], preset), all = [...frames, ...objects.filter(o => !insideStory(o))]
    for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++)
      assert.ok(!overlap(all[i], all[j]), `${all[i].id} overlaps ${all[j].id}`)
    for (const o of objects.filter(x => x.overlay)) {
      const under = objects.find(x => x.slotId === o.slotId && !x.overlay)
      assert.ok(o.x >= under.x - EPS && o.x + o.w <= under.x + under.w + EPS && o.y >= under.y - EPS && o.y + o.h <= under.y + under.h + EPS, `${o.id} leaves its photo`)
    }
    for (const o of objects.filter(x => x.frameId !== undefined)) {
      const home = frames.find(f => f.id === o.frameId)
      assert.ok(home, `${o.id} names a frame that does not exist`)
      assert.ok(o.x >= home.x - EPS && o.x + o.w <= home.x + home.w + EPS && o.y >= home.y - EPS && o.y + o.h <= home.y + home.h + EPS, `${o.id} leaves its story`)
      for (const f of frames) if (f !== home) assert.ok(!overlap(o, f), `${o.id} enters another story`)
    }
  })
  test(`${where}: a slot above another leaves at least one baseline of space`, () => {
    const { frames, objects } = build(templates[name], preset), all = [...frames, ...objects.filter(o => !insideStory(o))]
    for (const a of all) for (const b of all) {
      const sameColumn = a.x < b.x + b.w - EPS && b.x < a.x + a.w - EPS
      if (a !== b && a.slotId !== b.slotId && sameColumn && b.y >= a.y + a.h - EPS)
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
  test(`${where}: every record has orgId, and the result is deterministic`, () => {
    const page = build(templates[name], preset)
    for (const r of [...page.frames, ...page.objects]) assert.equal(r.orgId, orgId)
    assert.deepEqual(build(templates[name], preset), page)
  })
  test(`${where}: story frames take text around their photos, and no line enters a photo`, () => {
    const { frames, objects } = build(templates[name], preset), lineHeight = preset.grid.baseline
    for (const f of frames) {
      const columns = frameColumns(f), set = objects.filter(o => o.frameId === f.id)
      assert.equal(columns.length, f.cols)
      const obstacles = wrapObstacles(set, columns, { lineHeight })
      const opts = { font: '3px "Fake"', lineHeight }, text = 'कखग घङच '.repeat(4000)
      const r = fit(text, columns, obstacles, opts)
      assert.ok(r.lines > 0, `${f.id} takes no text`)
      assert.ok(r.overflowLines > 0)
      for (const l of flow(text, columns, obstacles, opts).lines) for (const o of set) {
        // A plain box blocks its whole rectangle; a shape blocks only its outline, which wrap.test.js checks line by line.
        if (o.wrap.mode === 'box') assert.ok(!overlap({ x: l.x, y: l.y, w: l.w, h: lineHeight }, o), `a line in ${f.id} enters ${o.id}`)
        else assert.ok(l.x + l.w <= o.x + o.w + EPS || l.x >= o.x - EPS || l.y + lineHeight <= o.y + EPS || l.y >= o.y + o.h - EPS, `a line in ${f.id} crosses ${o.id}`)
      }
    }
  })
}

const objectsOf = (name, role) => build(templates[name], newspaper).objects.filter(o => o.style.role === role)
const storySlots = t => t.slots.filter(s => s.kind === 'story')

test('the front page matches the printed one: masthead, two ears, strip, a lead and two more stories, no print line', () => {
  assert.equal(objectsOf('weekly-front', 'masthead').length, 1)
  assert.equal(objectsOf('weekly-front', 'ear').length, 2)
  assert.equal(objectsOf('weekly-front', 'strip').length, 1)
  assert.equal(objectsOf('weekly-front', 'imprint').length, 0)
  const stories = storySlots(templates['weekly-front'])
  assert.equal(stories.filter(s => s.priority === 1).length, 1)
  assert.ok(stories.length >= 3)
  assert.equal(stories.find(s => s.priority === 1).span, newspaper.grid.cols, 'the lead runs the full width')
})

test('inner and back pages have a folio strip and stories in halves and thirds', () => {
  for (const name of ['weekly-inner', 'weekly-back']) {
    assert.equal(objectsOf(name, 'folio').length, 1, name)
    const spans = storySlots(templates[name]).map(s => s.span)
    assert.ok(spans.includes(newspaper.grid.cols / 2), `${name} has no half-width story`)
    assert.ok(spans.includes(newspaper.grid.cols / 3), `${name} has no third-width story`)
  }
})

test('only last-page templates carry the print line', () => {
  for (const name of NAMES) assert.equal(objectsOf(name, 'imprint').length, /back/.test(name) ? 1 : 0, name)
})

// Variety: pages must not all look the same (Amal, D-059).
const allInsets = NAMES.flatMap(n => storySlots(templates[n]).filter(s => s.inset).map(s => s.inset))
test('there are several layouts for each kind of page', () => {
  const count = re => NAMES.filter(n => re.test(n)).length
  assert.ok(count(/front/) >= 3, 'front'); assert.ok(count(/inner/) >= 5, 'inner'); assert.ok(count(/back/) >= 2, 'last'); assert.ok(count(/ads/) >= 2, 'ads')
})
test('no two templates share a layout', () => {
  const layout = t => JSON.stringify(t.slots.map(s => [s.kind, s.col, s.span, s.row, s.rows, s.textCols, s.inset?.side, s.inset?.shape]))
  assert.equal(new Set(NAMES.map(n => layout(templates[n]))).size, NAMES.length)
})
test('photos sit left, right and in the middle of text, in plain, round and cut-out shapes', () => {
  for (const side of ['left', 'right', 'center']) assert.ok(allInsets.some(i => i.side === side), side)
  for (const shape of ['round', 'cutout']) assert.ok(allInsets.some(i => i.shape === shape), shape)
  assert.ok(allInsets.some(i => i.place === 'middle'), 'middle')
  const sides = allInsets.filter(i => i.side === 'left').length / allInsets.length
  assert.ok(sides < 0.6, `${Math.round(sides * 100)}% of photos sit on the left`)
})
test('a page can lead with a big photo, a cut-out beside the masthead, a side rail, a quote, a tinted panel, or a half-page ad', () => {
  const kinds = new Set(NAMES.flatMap(n => templates[n].slots.map(s => s.kind)))
  for (const k of ['hero', 'cutout', 'quote', 'section']) assert.ok(kinds.has(k), k)
  assert.ok(NAMES.some(n => storySlots(templates[n]).some(s => s.boxed)), 'tinted panel')
  assert.ok(NAMES.some(n => storySlots(templates[n]).some(s => s.span === 1)), 'one-column rail')
  assert.ok(NAMES.some(n => templates[n].slots.some(s => s.kind === 'ad' && s.span === 6 && s.rows >= 25)), 'half-page ad')
})
test('a cut-out beside the masthead is a free-form photo, and a hero can carry the section name', () => {
  const c = objectsOf('front-hero', 'cutout')[0]
  assert.equal(c.kind, 'photo'); assert.equal(c.wrap.mode, 'shape'); assert.ok(c.wrap.polygon.length >= 3)
  assert.equal(objectsOf('inner-hero', 'sectionLabel').length, 1)
})
test('round and cut-out photos make the text follow their outline; a centred photo has text on both sides', () => {
  const lineHeight = newspaper.grid.baseline, opts = { font: '3px "Fake"', lineHeight }, text = 'कखग घङच '.repeat(4000)
  const lines = name => { const { frames, objects } = build(templates[name], newspaper); const f = frames.find(x => objects.some(o => o.frameId === x.id)); const cols = frameColumns(f); return { f, o: objects.find(o => o.frameId === f.id && o.style.role === 'inset'), got: flow(text, cols, wrapObstacles(objects.filter(o => o.frameId === f.id), cols, { lineHeight }), opts).lines } }
  const { f, o, got } = lines('inner-cutout')
  assert.equal(o.wrap.mode, 'shape')
  const beside = got.filter(l => l.y >= o.y && l.y + lineHeight <= o.y + o.h && l.x >= f.x + 0.01)
  assert.ok(new Set(beside.map(l => l.x.toFixed(2))).size > 2, 'lines beside a cut-out should start at different places')
  const c = lines('inner-center')
  const row = c.got.filter(l => l.y >= c.o.y && l.y + lineHeight <= c.o.y + c.o.h)
  assert.ok(row.some(l => l.x + l.w <= c.o.x + 0.01) && row.some(l => l.x >= c.o.x + c.o.w - 0.01), 'text should sit on both sides')
})

test('the ads page has a folio and many ads in several sizes', () => {
  const t = templates['weekly-ads'], ads = t.slots.filter(s => s.kind === 'ad')
  assert.equal(objectsOf('weekly-ads', 'folio').length, 1)
  assert.ok(ads.length >= 12, `only ${ads.length} ads`)
  assert.ok(new Set(ads.map(a => `${a.span}x${a.rows}`)).size >= 3, 'ads should come in several sizes')
})

test('a story slot builds a kicker, headline and byline above its text, on the baseline grid', () => {
  const t = templates['weekly-front'], lead = storySlots(t).find(s => s.priority === 1)
  const { frames, objects } = build(t, newspaper), b = newspaper.grid.baseline
  const frame = frames.find(f => f.slotId === lead.id)
  assert.equal(frame.cols, lead.textCols)
  let y = null
  for (const part of ['kicker', 'headline', 'byline']) {
    const o = objects.find(x => x.slotId === lead.id && x.style.role === part)
    assert.ok(o, `no ${part}`)
    assert.equal(o.x, frame.x); assert.equal(o.w, frame.w)
    assert.ok(Math.abs(o.h - lead.head[part] * b) < EPS, `${part} height`)
    if (y !== null) assert.ok(Math.abs(o.y - y) < EPS, `${part} does not follow the part above`)
    y = o.y + o.h
  }
  assert.ok(Math.abs(frame.y - y) < EPS, 'the text does not start below the byline')
})

test('a photo set into a story brings a caption, and the text wraps the pair as a plain box', () => {
  const t = templates['weekly-front'], lead = storySlots(t).find(s => s.priority === 1)
  const { frames, objects } = build(t, newspaper)
  const frame = frames.find(f => f.slotId === lead.id)
  const photo = objects.find(o => o.slotId === lead.id && o.style.role === 'inset'), caption = objects.find(o => o.slotId === lead.id && o.style.role === 'caption')
  assert.equal(photo.kind, 'photo')
  assert.equal(photo.frameId, frame.id); assert.equal(caption.frameId, frame.id)
  assert.ok(Math.abs(photo.w - frame.w * lead.inset.width) < EPS)
  assert.ok(Math.abs(caption.y - (photo.y + photo.h)) < EPS, 'the caption sits under the photo')
  assert.equal(caption.wrap.mode, 'box'); assert.equal(photo.wrap.mode, 'box')
  assert.equal(photo.x, frame.x, 'set at the left of the text, as printed')
})

test('a side of right sets the photo at the right of the text', () => {
  const t = structuredClone(templates['weekly-front']), lead = storySlots(t).find(s => s.priority === 1)
  lead.inset.side = 'right'
  const { frames, objects } = build(t, newspaper), frame = frames.find(f => f.slotId === lead.id)
  const photo = objects.find(o => o.slotId === lead.id && o.style.role === 'inset')
  assert.ok(Math.abs(photo.x + photo.w - (frame.x + frame.w)) < EPS)
})

test('templates hold grid units, never millimetres', () => {
  for (const t of Object.values(templates)) for (const s of t.slots) {
    for (const k of ['x', 'y', 'w', 'h', 'mm']) assert.equal(k in s, false, `${t.id} slot ${s.id} has ${k}`)
    for (const k of ['col', 'span', 'row', 'rows']) assert.ok(Number.isInteger(s[k]), `${t.id} slot ${s.id}: ${k}`)
  }
})

test('assertTemplate refuses a template that does not fit its grid', () => {
  const t = templates['weekly-back']
  const change = fn => { const c = structuredClone(t); fn(c); return c }
  const story = c => c.slots.find(x => x.kind === 'story')
  const bad = {
    'wrong column count for the preset': c => { c.columns = 7 },
    'slot past the last column': c => { c.slots[0].col = 5; c.slots[0].span = 3 },
    'slot past the last row': c => { c.slots[0].row = c.rows - 1; c.slots[0].rows = 5 },
    'half a column': c => { c.slots[0].span = 1.5 },
    'no rows': c => { c.slots[0].rows = 0 },
    'unknown kind': c => { c.slots[0].kind = 'poster' },
    'two slots with one id': c => { c.slots[1].id = c.slots[0].id },
    'two slots in one place': c => { c.slots[1] = { ...c.slots[0], id: 'copy' } },
    'story with no priority': c => { delete story(c).priority },
    'story with no text columns': c => { delete story(c).textCols },
    'more text columns than grid columns': c => { const s = story(c); s.textCols = s.span + 1 },
    'story with no head': c => { delete story(c).head },
    'head with half a line': c => { story(c).head.headline = 1.5 },
    'inset wider than its story': c => { story(c).inset = { side: 'left', width: 1.5, rows: 4, caption: 1 } },
    'inset on an unknown side': c => { story(c).inset = { side: 'top', width: 0.5, rows: 4, caption: 1 } },
    'inset in an unknown place': c => { story(c).inset = { side: 'left', place: 'foot', width: 0.5, rows: 4, caption: 1 } },
    'inset with an unknown shape': c => { story(c).inset = { side: 'left', shape: 'star', width: 0.5, rows: 4, caption: 1 } },
    'two print lines': c => { c.slots.push({ ...c.slots.find(s => s.kind === 'imprint'), id: 'second', row: 0, rows: 1 }) },
    'no id': c => { delete c.id },
  }
  assert.doesNotThrow(() => assertTemplate(t, newspaper))
  for (const [name, fn] of Object.entries(bad)) assert.throws(() => assertTemplate(change(fn), newspaper), /template/, name)
})

test('a story whose head and photo leave no room for text is refused on that preset', () => {
  const t = structuredClone(templates['weekly-front']), s = storySlots(t).find(x => x.priority === 1)
  s.head.headline = 500
  assert.throws(() => build(t, newspaper), /template/)
})

test('the print line has every field the printed page shows, and all of them are marked as placeholders', () => {
  assert.doesNotThrow(() => assertImprint(janshakti.imprint))
  const fields = ['owner', 'printer', 'placeOfPrinting', 'publisher', 'placeOfPublication', 'editor', 'registrationNo', 'mobile', 'email', 'jurisdiction']
  for (const f of fields) {
    assert.ok(janshakti.imprint[f], f)
    assert.match(janshakti.imprint[f], /^\[.+\]$/, `${f} must stay a marked placeholder until Amal enters it`)
  }
  assert.deepEqual([...janshakti.imprint.assumed].sort(), [...fields].sort())
  assert.throws(() => assertImprint({ ...janshakti.imprint, editor: '' }), /imprint/)
  assert.throws(() => assertImprint({ ...janshakti.imprint, registrationNo: undefined }), /imprint/)
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
  let doc = apply(makeDoc(rng(2)), { type: 'applyTemplate', args: { pageId: 'p0', template: templates['weekly-front'] } }).doc
  const frontFrame = doc.pages[0].frames[0].id
  doc = apply(doc, { type: 'placeStory', args: { frameId: frontFrame, storyId: 's1' } }).doc
  const { doc: out, inverse } = apply(doc, { type: 'applyTemplate', args: { pageId: 'p0', template: templates['weekly-ads'] } })
  assert.equal(out.pages[0].frames.some(f => f.storyId), false)
  assert.deepEqual(apply(out, JSON.parse(JSON.stringify(inverse))).doc, doc)
})

test('applyTemplate refuses a template for another grid and an unknown page, and changes nothing', () => {
  const doc = makeDoc(rng(2))
  assert.throws(() => apply(doc, { type: 'applyTemplate', args: { pageId: 'p1', template: { ...templates['weekly-inner'], columns: 7 } } }), /template/)
  assert.throws(() => apply(doc, { type: 'applyTemplate', args: { pageId: 'nope', template: templates['weekly-inner'] } }), /no page/)
})

test('a document with a bad imprint is refused', () => {
  const doc = makeDoc(rng(3))
  assert.doesNotThrow(() => assertDoc(doc))
  assert.throws(() => assertDoc({ ...doc, imprint: { printer: 'x' } }), /imprint/)
})

test('issueHasPrintLine is true only when a page carries it', () => {
  let doc = makeDoc(rng(3))
  doc = apply(doc, { type: 'applyTemplate', args: { pageId: 'p0', template: templates['weekly-front'] } }).doc
  assert.equal(issueHasPrintLine(doc), false, 'a front page alone has no print line')
  doc = apply(doc, { type: 'applyTemplate', args: { pageId: 'p2', template: templates['weekly-back'] } }).doc
  assert.equal(issueHasPrintLine(doc), true)
  const line = doc.pages[2].objects.find(o => o.style.role === 'imprint')
  assert.equal(issueHasPrintLine(apply(doc, { type: 'removeBlock', args: { objectId: line.id } }).doc), false)
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

// Mutation check on the geometry: a photo the text does not wrap must fail the line test's own comparison.
test('mutation check, the line test fails when a photo does not make the text wrap', () => {
  const t = templates['weekly-front'], { frames, objects } = build(t, newspaper), lineHeight = newspaper.grid.baseline
  const f = frames.find(x => objects.some(o => o.frameId === x.id)), set = objects.filter(o => o.frameId === f.id)
  const text = 'कखग घङच '.repeat(4000), columns = frameColumns(f)
  const lines = flow(text, columns, [], { font: '3px "Fake"', lineHeight }).lines
  assert.ok(lines.some(l => set.some(o => overlap({ x: l.x, y: l.y, w: l.w, h: lineHeight }, o))), 'without wrapping, some line must enter the photo')
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
