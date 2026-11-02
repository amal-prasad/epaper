import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(new URL('../../../spike/package.json', import.meta.url))
const { createCanvas } = require('@napi-rs/canvas')
const moduleUrl = new URL('../../../scripts/golden-compare.mjs', import.meta.url)
const load = () => import(moduleUrl)
const provenance = { raster: 'screen-96dpi', chromium: 'test', platform: 'test', node: 'test', canvas: 'test', playwright: 'test', fonts: { bundled: 'abc' } }
const png = (paint = () => {}) => {
  const canvas = createCanvas(100, 120), ctx = canvas.getContext('2d')
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, 100, 120)
  ctx.fillStyle = '#000000'; paint(ctx)
  return canvas.toBuffer('image/png')
}

test('golden comparator accepts identical decoded pixels and rejects a one-pixel matra/rule defect', async () => {
  const { comparePng } = await load()
  const base = png(c => c.fillRect(10, 20, 70, 1))
  assert.equal((await comparePng(base, base)).ok, true)
  const defect = png(c => c.fillRect(10, 20, 69, 1))
  const result = await comparePng(base, defect)
  assert.equal(result.ok, false)
  assert.equal(result.changedPixels, 1)
  assert.deepEqual(result.bounds, { x: 79, y: 20, w: 1, h: 1 })
})

test('golden comparator rejects changed colour, shifted geometry and image dimensions', async () => {
  const { comparePng } = await load()
  const base = png(c => c.fillRect(10, 20, 70, 1))
  assert.equal((await comparePng(base, png(c => c.fillRect(10, 21, 70, 1)))).ok, false)
  assert.equal((await comparePng(base, png(c => { c.fillStyle = '#010000'; c.fillRect(10, 20, 70, 1) }))).ok, false)
  const other = createCanvas(101, 120).toBuffer('image/png')
  assert.match((await comparePng(base, other)).reason, /dimensions/)
})

test('baseline comparison refuses missing or unreviewed baseline, corrupted pixels and changed fixture/font provenance', async () => {
  const { compareManifests, hash } = await load()
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'studio-golden-test-'))
  try {
    const pixels = png(c => c.fillRect(10, 20, 70, 1))
    await fs.writeFile(path.join(dir, 'page.png'), pixels)
    await fs.writeFile(path.join(dir, 'page.json'), '{"copy":"owned"}\n')
    const manifest = { schemaVersion: 1, status: 'candidate', provenance, pages: [
      { id: 'test', image: 'page.png', imageHash: hash(pixels), fixture: 'page.json', fixtureHash: hash('{"copy":"owned"}\n') }
    ] }
    const candidatePath = path.join(dir, 'candidate.json'), baselinePath = path.join(dir, 'baseline.json')
    const write = async value => fs.writeFile(baselinePath, JSON.stringify(value))
    await fs.writeFile(candidatePath, JSON.stringify(manifest))
    await assert.rejects(compareManifests(candidatePath, baselinePath), /baseline.*missing/i)
    await write(manifest)
    await assert.rejects(compareManifests(candidatePath, baselinePath), /human.review/i)
    const reviewed = { ...manifest, status: 'human-reviewed', review: { by: 'Human reviewer', at: '2026-11-02', note: 'Reviewed all pages at full size' } }
    await write(reviewed)
    assert.equal((await compareManifests(candidatePath, baselinePath)).ok, true)
    await assert.rejects(compareManifests(candidatePath, baselinePath, { requirePageCount: 10 }), /10 pages/)
    await write({ ...reviewed, provenance: {} })
    await fs.writeFile(candidatePath, JSON.stringify({ ...manifest, provenance: {} }))
    await assert.rejects(compareManifests(candidatePath, baselinePath), /provenance/)
    await fs.writeFile(candidatePath, JSON.stringify(manifest))
    await write({ ...reviewed, provenance: { ...reviewed.provenance, fonts: { bundled: 'different' } } })
    await assert.rejects(compareManifests(candidatePath, baselinePath), /provenance/)
    await write({ ...reviewed, pages: [{ ...reviewed.pages[0], fixtureHash: 'changed' }] })
    await assert.rejects(compareManifests(candidatePath, baselinePath), /hash/)
    await write(reviewed)
    await fs.writeFile(path.join(dir, 'page.png'), png())
    await assert.rejects(compareManifests(candidatePath, baselinePath), /hash/)
  } finally { await fs.rm(dir, { recursive: true, force: true }) }
})

test('baseline comparison rejects missing pages and path escapes', async () => {
  const { compareManifests } = await load()
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'studio-golden-test-'))
  try {
    const base = { schemaVersion: 1, status: 'human-reviewed', review: { by: 'Human', at: '2026-11-02', note: 'Reviewed' }, provenance, pages: [{ id: 'test', image: '../escape.png' }] }
    const baselinePath = path.join(dir, 'baseline.json'), candidatePath = path.join(dir, 'candidate.json')
    await fs.writeFile(baselinePath, JSON.stringify(base)); await fs.writeFile(candidatePath, JSON.stringify(base))
    await assert.rejects(compareManifests(candidatePath, baselinePath), /path/)
    await fs.writeFile(candidatePath, JSON.stringify({ ...base, pages: [] }))
    await assert.rejects(compareManifests(candidatePath, baselinePath), /pages/)
  } finally { await fs.rm(dir, { recursive: true, force: true }) }
})

test('ten owned fixtures are deterministic and cover template, wrap, ad and size variations', async () => {
  const { buildGoldenFixtures } = await import('../../../scripts/golden-pages.mjs')
  const first = buildGoldenFixtures(), second = buildGoldenFixtures()
  assert.deepEqual(first, second)
  assert.equal(first.length, 10)
  assert.equal(new Set(first.map(f => f.templateId)).size, 10)
  assert.ok(new Set(first.map(f => JSON.stringify(f.document.preset.page))).size >= 2)
  const objects = first.flatMap(f => f.document.pages[0].objects)
  assert.ok(objects.some(o => o.wrap.mode === 'shape'))
  assert.ok(objects.some(o => o.kind === 'ad'))
  assert.ok(first.every(f => f.document.stories.every(s => s.licence === 'own-synthetic')))
  assert.ok(first.every(f => f.document.pages[0].frames.every(frame => frame.storyId)))
  for (const id of ['weekly-inner', 'weekly-back']) {
    const dense = first.find(f => f.templateId === id)
    assert.ok(dense.document.stories.every(s => s.body[0].length >= 6 * 130))
  }
})
