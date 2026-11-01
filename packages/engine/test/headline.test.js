// Headlines are fitted to their space, using each font's measured ink, and never clipped (bug, 2026-11-01: matras cut off and a
// second line lost, because the demo clipped a fixed band at line-height 1.14; Khand 700 ink is about 1.4 em tall).
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { installFakeCanvas, CHAR_W } from './helpers/fake-canvas.js'

installFakeCanvas()
const { layoutHeadline } = await import('../src/headline.js')

const read = rel => JSON.parse(fs.readFileSync(new URL(`../../../${rel}`, import.meta.url), 'utf8'))
const inks = read('fonts/ink.json')
const preset = read('presets/newspaper.json')
const fontList = read('spike/fonts.json').fonts
const INK = { top: 1, bottom: 0.4 }
const base = { family: 'Fake', weight: 700, ink: INK }
const squash = s => s.replace(/\s+/g, '')

test('line spacing comes from the ink, so lines never overlap, whatever the font', () => {
  const r = layoutHeadline('क'.repeat(40), { ...base, sizes: [20], width: 11 * CHAR_W, height: 1000 })
  assert.equal(r.lines.length, 4)
  assert.equal(r.pitch, 20 * 1.4)
  r.lines.forEach((l, i) => assert.ok(Math.abs(l.baseline - (20 * 1 + i * 28)) < 1e-9, `line ${i}`))
})

test('the first line leaves room for matras above the baseline', () => {
  const r = layoutHeadline('कि', { ...base, sizes: [30], width: 500, height: 500 })
  assert.equal(r.lines[0].baseline, 30 * INK.top)
})

test('a headline too tall at the largest size steps down until it fits', () => {
  const text = 'क'.repeat(20), width = 10 * CHAR_W     // two lines at any size: fake glyphs do not scale
  const r = layoutHeadline(text, { ...base, sizes: [40, 30, 20], width, height: 60 })
  assert.equal(r.size, 20)
  assert.equal(r.fits, true)
  assert.ok(r.height <= 60)
})

test('the largest size that fits is used', () => {
  const r = layoutHeadline('क'.repeat(5), { ...base, sizes: [40, 30, 20], width: 500, height: 56 })
  assert.equal(r.size, 40)
})

test('a headline that fits at no size is flagged, keeps all its text, and is not cut', () => {
  const text = 'क'.repeat(60), r = layoutHeadline(text, { ...base, sizes: [20, 10], width: 5 * CHAR_W, height: 20 })
  assert.equal(r.fits, false)
  assert.equal(r.size, 10)
  assert.equal(squash(r.lines.map(l => l.text).join('')), text)
  assert.ok(r.height > 20, 'height reports what it really needs')
})

test('the exact headline from the bug keeps all its text', () => {
  const text = '2030 तक पूर्वोत्तर में 8 लाख रोजगार का लक्ष्य, NCDC को मिला 25 साल का रोडमैप बनाने का निर्देश'
  const r = layoutHeadline(text, { ...base, sizes: [26, 24, 22], width: 480, height: 63.5 })
  assert.equal(squash(r.lines.map(l => l.text).join('')), squash(text))
  if (r.fits) assert.ok(r.height <= 63.5)
})

test('refuses input that could not be laid out', () => {
  assert.throws(() => layoutHeadline('क', { ...base, sizes: [], width: 100, height: 100 }), /sizes/)
  assert.throws(() => layoutHeadline('क', { ...base, sizes: [10], width: 0, height: 100 }), /width/)
  assert.throws(() => layoutHeadline('क', { ...base, sizes: [10], width: 100, height: 100, ink: { top: 0 } }), /ink/)
})

test('it is deterministic and does not change its input', () => {
  const opts = { ...base, sizes: [30, 20], width: 80, height: 90 }, copy = structuredClone(opts)
  assert.deepEqual(layoutHeadline('कख गघ '.repeat(8), opts), layoutHeadline('कख गघ '.repeat(8), opts))
  assert.deepEqual(opts, copy)
})

test('every launch font has measured ink at every weight, tall enough for matras', () => {
  const launch = fontList.filter(f => f.launch && ['headline', 'text', 'text-serif'].includes(f.role))
  assert.ok(launch.length >= 4)
  for (const f of launch) for (const w of f.weights ?? [400]) {
    const ink = inks[f.name]?.[w]
    assert.ok(ink, `no ink for ${f.name} ${w}`)
    assert.ok(ink.top > 0.8 && ink.bottom > 0.2, `${f.name} ${w} looks unmeasured`)
    assert.ok(ink.ascent > 0 && ink.descent > 0, `${f.name} ${w} has no font metrics`)
  }
})

test('the preset names a headline font with measured ink and size steps for every priority', () => {
  const h = preset.headline
  assert.ok(inks[h.family]?.[h.weight], `${h.family} ${h.weight}`)
  for (const p of [1, 2, 3]) {
    assert.ok(h.sizes[p].length >= 2, `priority ${p} needs sizes to step through`)
    assert.deepEqual([...h.sizes[p]], [...h.sizes[p]].sort((a, b) => b - a), `priority ${p} sizes run largest first`)
  }
})

// Mutation check: the real headline.js with the fitting and spacing broken; these tests' own comparisons must catch it.
test('mutation check: ignoring the height limit, or spacing lines tighter than the ink, is caught', async () => {
  const source = fs.readFileSync(new URL('../src/headline.js', import.meta.url), 'utf8')
  const load = (from, to) => {
    assert.equal(source.split(from).length, 2, `mutation target must appear exactly once: ${from}`)
    const src = source.replace(from, to).replace(/from '\.\//g, `from '${new URL('../src/', import.meta.url).href}`)
    return import('data:text/javascript;base64,' + Buffer.from(src).toString('base64'))
  }
  const noLimit = await load('if (height_ <= height + EPS)', 'if (true)')
  assert.notEqual(noLimit.layoutHeadline('क'.repeat(20), { ...base, sizes: [40, 30, 20], width: 10 * CHAR_W, height: 60 }).size, 20)
  const tight = await load('const pitch = size * (ink.top + ink.bottom)', 'const pitch = size * 1.14')
  assert.notEqual(tight.layoutHeadline('क'.repeat(40), { ...base, sizes: [20], width: 11 * CHAR_W, height: 1000 }).pitch, 20 * 1.4)
})
