// Document model and ops (Phase 1 step 1). Rule 14: every op has an inverse, passes fuzzUndo and never mutates its input.
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { fuzzUndo, rng, pick, int } from './helpers/fuzz.js'
import { apply, startHistory, run, undo, redo, replay } from '../src/ops.js'
import { SCHEMA_VERSION, migrate, assertDoc } from '../src/doc.js'

const OPS_SOURCE = fs.readFileSync(new URL('../src/ops.js', import.meta.url), 'utf8')
const json = v => JSON.parse(JSON.stringify(v))     // the op log is stored as JSON, so inverses must survive it

const orgId = 'org1'
const object = (id, x, y, w, h, extra = {}) => ({ id, orgId, kind: 'photo', x, y, w, h, z: 0, wrap: { mode: 'box', offset: { top: 1, right: 1, bottom: 1, left: 1 } }, style: {}, ...extra })

function makeDoc(r = rng(1)) {
  const stories = ['s1', 's2', 's3', 's4'].map(id => ({ id, orgId, headline: id, body: [], assetIds: [] }))
  const pages = [0, 1].map(p => {
    const objects = []
    for (let i = 0; i < int(r, 3, 6); i++) {
      // Non-round values, so a scale followed by its undo would show float drift if the inverse recomputed instead of restoring.
      const extra = {}
      if (i && r() < 0.4) extra.parentId = objects[int(r, 0, i - 1)].id
      if (r() < 0.3) extra.rot = int(r, 1, 89) / 7
      objects.push(object(`p${p}o${i}`, r() * 100, r() * 100, 1 + r() * 50, 1 + r() * 50, extra))
    }
    const frame = (i, extra = {}) => ({ id: `p${p}f${i}`, orgId, x: 10 * i, y: 0, w: 10, h: 10, cols: 1, gutter: 1, ...extra })
    // f0 flows on into f1; f2 and f3 stand alone.
    return { id: `p${p}`, orgId, no: p + 1, objects, frames: [frame(0, { nextFrameId: `p${p}f1` }), frame(1), frame(2), frame(3)] }
  })
  pages[0].frames[0].storyId = 's1'
  pages[1].frames[2].storyId = 's2'
  return { schemaVersion: SCHEMA_VERSION, id: 'issue1', orgId, stories, pages }
}

const frames = doc => doc.pages.flatMap(p => p.frames)
const objects = doc => doc.pages.flatMap(p => p.objects)

const GENS = {
  placeStory(r, doc) {
    const all = frames(doc), heads = all.filter(f => !all.some(o => o.nextFrameId === f.id))
    const frame = pick(r, heads)
    const free = doc.stories.filter(s => !all.some(f => f.storyId === s.id))
    const storyId = r() < 0.25 || !free.length ? null : pick(r, free).id
    return { frameId: frame.id, storyId }
  },
  setObjectGeometry(r, doc) {
    const all = objects(doc)
    if (!all.length) return null
    const args = { objectId: pick(r, all).id }
    if (r() < 0.7) { args.x = r() * 100; args.y = r() * 100 }
    if (r() < 0.7) { args.w = 1 + r() * 50; args.h = 1 + r() * 50 }
    if (r() < 0.2) args.rot = r() * 90
    return args
  },
  removeBlock(r, doc) {
    const all = objects(doc)
    return all.length ? { objectId: pick(r, all).id } : null
  },
}
const NAMES = Object.keys(GENS)

const fuzzOps = applyFn => NAMES.map(name => ({
  name,
  gen: GENS[name],
  apply(doc, args) {
    const out = applyFn(doc, { type: name, args })
    assertDoc(out.doc)
    const inverse = json(out.inverse)
    return { doc: out.doc, inverse: d => applyFn(d, inverse).doc }
  },
}))

test('fuzzUndo passes over placeStory, setObjectGeometry and removeBlock', () => {
  const seen = new Set()
  const ops = fuzzOps(apply).map(o => ({ ...o, apply(doc, args) { seen.add(o.name); return o.apply(doc, args) } }))
  fuzzUndo({ makeDoc, ops })
  assert.deepEqual([...seen].sort(), [...NAMES].sort(), 'every op must actually run under the fuzz')
})

// Mutation check: the real ops.js source with one inverse broken on purpose. The fuzz must fail on each.
const MUTANTS = [
  { name: 'placeStory inverse forgets the story that was there', from: 'storyId: frame.storyId ?? null', to: 'storyId: null' },
  { name: 'setObjectGeometry inverse leaves child objects where they moved', from: 'geometries: family.map(snapshot)', to: 'geometries: family.slice(0, 1).map(snapshot)' },
  { name: 'removeBlock inverse puts objects back at the wrong place', from: 'splice(index, 0, entry)', to: 'splice(0, 0, entry)' },
  { name: 'removeBlock inverse drops all but one removed object', from: 'entries: removed }', to: 'entries: removed.slice(0, 1) }' },
]

for (const m of MUTANTS) {
  test(`mutation check, fuzz fails when: ${m.name}`, async () => {
    assert.equal(OPS_SOURCE.split(m.from).length, 2, `mutation target must appear exactly once in ops.js: ${m.from}`)
    const url = 'data:text/javascript;base64,' + Buffer.from(OPS_SOURCE.replace(m.from, m.to)).toString('base64')
    const mutated = await import(url)
    let message = null
    try { fuzzUndo({ makeDoc, ops: fuzzOps(mutated.apply) }) } catch (e) { message = e.message }
    assert.ok(message, `fuzz passed on a broken inverse: ${m.name}`)
    assert.match(message, /\[fuzz seed \d+\] undoing every op did not restore the starting document/)
    console.log(`MUTANT CAUGHT  ${m.name}\n  ${m.from}  ->  ${m.to}\n  ${message.split('\n')[0]}`)
  })
}

test('an op does not mutate its input, and a mutating op fails the fuzz', async () => {
  const frozen = o => { Object.values(o).forEach(v => { if (v && typeof v === 'object') frozen(v) }); return Object.freeze(o) }
  const r = rng(7)
  let doc = frozen(makeDoc(r))
  for (let i = 0; i < 300; i++) {
    const name = pick(r, NAMES), args = GENS[name](r, doc)
    if (args) doc = frozen(apply(doc, { type: name, args }).doc)
  }
  const from = 'const next = { ...frame }', to = 'const next = frame'
  assert.equal(OPS_SOURCE.split(from).length, 2, `mutation target must appear exactly once in ops.js: ${from}`)
  const mutated = await import('data:text/javascript;base64,' + Buffer.from(OPS_SOURCE.replace(from, to)).toString('base64'))
  assert.throws(() => fuzzUndo({ makeDoc, ops: fuzzOps(mutated.apply) }), /fuzz seed/)
})

test('the inverse of an inverse redoes the op, as data', () => {
  const r = rng(11)
  for (let i = 0; i < 500; i++) {
    const doc = makeDoc(r), name = pick(r, NAMES), args = GENS[name](r, doc)
    const a = apply(doc, { type: name, args })
    const b = apply(a.doc, json(a.inverse))
    assert.deepEqual(b.doc, doc)
    assert.deepEqual(apply(b.doc, json(b.inverse)).doc, a.doc)
  }
})

test('placeStory: places, replaces and clears; storyId disappears when cleared', () => {
  const doc = makeDoc()
  const placed = apply(doc, { type: 'placeStory', args: { frameId: 'p0f2', storyId: 's3' } })
  assert.equal(placed.doc.pages[0].frames[2].storyId, 's3')
  assert.deepEqual(placed.inverse, { type: 'placeStory', args: { frameId: 'p0f2', storyId: null } })
  const cleared = apply(placed.doc, placed.inverse).doc
  assert.equal('storyId' in cleared.pages[0].frames[2], false)
  const replaced = apply(doc, { type: 'placeStory', args: { frameId: 'p0f0', storyId: 's3' } })
  assert.deepEqual(replaced.inverse.args.storyId, 's1')
})

test('placeStory: a story belongs to at most one chain of frames', () => {
  const doc = makeDoc()
  assert.throws(() => apply(doc, { type: 'placeStory', args: { frameId: 'p0f2', storyId: 's1' } }), /already placed/)
  assert.throws(() => apply(doc, { type: 'placeStory', args: { frameId: 'p0f1', storyId: 's3' } }), /continues another frame/)
  assert.throws(() => apply(doc, { type: 'placeStory', args: { frameId: 'p0f2', storyId: 'nope' } }), /no story/)
  assert.throws(() => apply(doc, { type: 'placeStory', args: { frameId: 'nope', storyId: 's3' } }), /no frame/)
})

test('setObjectGeometry: children move and scale with the parent, at every depth', () => {
  const doc = makeDoc()
  doc.pages[0].objects = [object('a', 10, 10, 20, 20), object('b', 15, 15, 10, 10, { parentId: 'a' }), object('c', 20, 20, 2, 2, { parentId: 'b' }), object('d', 50, 50, 5, 5)]
  const { doc: out, inverse } = apply(doc, { type: 'setObjectGeometry', args: { objectId: 'a', x: 20, y: 30, w: 40, h: 10 } })
  const [a, b, c, d] = out.pages[0].objects
  assert.deepEqual([a.x, a.y, a.w, a.h], [20, 30, 40, 10])
  assert.deepEqual([b.x, b.y, b.w, b.h], [30, 32.5, 20, 5])
  assert.deepEqual([c.x, c.y, c.w, c.h], [40, 35, 4, 1])
  assert.deepEqual(d, doc.pages[0].objects[3], 'objects outside the family stay put')
  assert.deepEqual(apply(out, inverse).doc, doc)
})

test('setObjectGeometry: a rotation that was absent is absent again after undo', () => {
  const doc = makeDoc()
  doc.pages[0].objects = [object('a', 1, 2, 3, 4)]
  const { doc: out, inverse } = apply(doc, { type: 'setObjectGeometry', args: { objectId: 'a', rot: 12 } })
  assert.equal(out.pages[0].objects[0].rot, 12)
  assert.equal('rot' in apply(out, inverse).doc.pages[0].objects[0], false)
})

test('setObjectGeometry: rejects sizes and numbers a page cannot hold', () => {
  const doc = makeDoc()
  doc.pages[0].objects = [object('a', 1, 2, 3, 4)]
  for (const bad of [{ w: 0 }, { h: -1 }, { x: NaN }, { y: Infinity }, { w: '5' }])
    assert.throws(() => apply(doc, { type: 'setObjectGeometry', args: { objectId: 'a', ...bad } }), /geometry/, JSON.stringify(bad))
  assert.throws(() => apply(doc, { type: 'setObjectGeometry', args: { objectId: 'nope', x: 1 } }), /no object/)
})

test('removeBlock: takes its children with it and undo restores the exact order', () => {
  const doc = makeDoc()
  doc.pages[0].objects = [object('a', 1, 1, 1, 1), object('b', 2, 2, 2, 2, { parentId: 'a' }), object('c', 3, 3, 3, 3), object('d', 4, 4, 4, 4, { parentId: 'b' })]
  const { doc: out, inverse } = apply(doc, { type: 'removeBlock', args: { objectId: 'a' } })
  assert.deepEqual(out.pages[0].objects.map(o => o.id), ['c'])
  assert.deepEqual(apply(out, json(inverse)).doc, doc)
})

test('apply: an unknown op type fails, including names inherited from Object', () => {
  const doc = makeDoc()
  for (const type of ['nope', 'constructor', '__proto__', 'toString'])
    assert.throws(() => apply(doc, { type, args: {} }), /unknown op/, type)
})

test('history: undo and redo walk back and forth, a new op clears redo', () => {
  const doc = makeDoc()
  let h = startHistory(doc)
  assert.equal(undo(h), h, 'undo with nothing to undo changes nothing')
  assert.equal(redo(h), h, 'redo with nothing to redo changes nothing')
  h = run(h, { type: 'placeStory', args: { frameId: 'p0f2', storyId: 's3' } })
  const placed = h.doc
  h = run(h, { type: 'placeStory', args: { frameId: 'p0f3', storyId: 's4' } })
  const both = h.doc
  h = undo(undo(h))
  assert.deepEqual(h.doc, doc)
  h = redo(h)
  assert.deepEqual(h.doc, placed)
  h = redo(h)
  assert.deepEqual(h.doc, both)
  h = undo(h)
  h = run(h, { type: 'placeStory', args: { frameId: 'p1f3', storyId: 's4' } })
  assert.equal(redo(h), h, 'a new op clears redo')
})

test('history: a failed op leaves the history as it was', () => {
  const h = startHistory(makeDoc())
  assert.throws(() => run(h, { type: 'placeStory', args: { frameId: 'nope', storyId: 's3' } }), /no frame/)
  assert.equal(h.version, 0)
  assert.equal(h.log.length, 0)
})

test('op log: survives JSON, carries baseVersion, and replays to the same document', () => {
  const r = rng(3), start = makeDoc(r)
  let h = startHistory(start)
  for (let i = 0; i < 200; i++) {
    const roll = r()
    if (roll < 0.2) h = undo(h)
    else if (roll < 0.3) h = redo(h)
    else {
      const name = pick(r, NAMES), args = GENS[name](r, h.doc)
      if (args) h = run(h, { type: name, args })
    }
  }
  assert.ok(h.log.length > 100)
  h.log.forEach((entry, i) => assert.equal(entry.baseVersion, i))
  assert.equal(h.version, h.log.length)
  assert.deepEqual(replay(start, json(h.log)), h.doc)
})

test('doc: schemaVersion is required and a newer document is refused', () => {
  assert.throws(() => migrate({ orgId }), /schemaVersion/)
  assert.throws(() => migrate({ ...makeDoc(), schemaVersion: SCHEMA_VERSION + 1 }), /newer/)
})

test('doc: migrations run in order, are pure, and refuse a gap', () => {
  const v1 = Object.freeze({ schemaVersion: 1, orgId, name: 'a' })
  const migrations = { 1: d => ({ ...d, schemaVersion: 2, name: d.name + 'b' }), 2: d => ({ ...d, schemaVersion: 3, name: d.name + 'c' }) }
  assert.deepEqual(migrate(v1, migrations, 3), { schemaVersion: 3, orgId, name: 'abc' })
  assert.throws(() => migrate(v1, { 2: migrations[2] }, 3), /no migration from version 1/)
  assert.throws(() => migrate(v1, { 1: d => d }, 2), /did not advance/)
})

test('doc: every record carries orgId', () => {
  assert.doesNotThrow(() => assertDoc(makeDoc()))
  for (const strip of [d => delete d.orgId, d => delete d.stories[0].orgId, d => delete d.pages[0].orgId, d => delete d.pages[0].frames[0].orgId, d => delete d.pages[0].objects[0].orgId]) {
    const doc = makeDoc(); strip(doc)
    assert.throws(() => assertDoc(doc), /orgId/, strip.toString())
  }
})

test('doc: wrap mode is none, box, shape or jump (D-035); contour is refused', () => {
  for (const mode of ['none', 'box', 'shape', 'jump']) {
    const doc = makeDoc(); doc.pages[0].objects[0].wrap.mode = mode
    assert.doesNotThrow(() => assertDoc(doc), mode)
  }
  const doc = makeDoc(); doc.pages[0].objects[0].wrap.mode = 'contour'
  assert.throws(() => assertDoc(doc), /wrap mode/)
})

test('doc: a story in two chains is refused', () => {
  const doc = makeDoc(); doc.pages[1].frames[3].storyId = 's1'
  assert.throws(() => assertDoc(doc), /more than one/)
})
