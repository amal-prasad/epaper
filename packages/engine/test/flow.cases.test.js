// Phase 0 task 5: named layout cases for flow() (gate G0.flow). Contract invariants come from helpers/invariants.js.
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { installFakeCanvas, fakeWidth } from './helpers/fake-canvas.js'
import { assertAll } from './helpers/invariants.js'

installFakeCanvas()                                   // before flow.js loads Pretext
const { flow } = await import('../src/flow.js')

const here = path.dirname(fileURLToPath(import.meta.url))
const samplesDir = path.join(here, '../../../spike/samples')
const real = fs.existsSync(samplesDir) ? fs.readdirSync(samplesDir).filter(f => f.endsWith('.txt'))
  .flatMap(f => fs.readFileSync(path.join(samplesDir, f), 'utf8').split(/\n\s*\n/)).map(s => s.replace(/\s+/g, ' ').trim()).filter(s => s.length > 40) : []
const story = (real.length ? real : ['मध्य प्रदेश में सरकारी नौकरी की तैयारी कर रहे युवाओं के लिए बड़ी खबर है। मुख्यमंत्री डॉ. मोहन यादव के नेतृत्व वाली सरकार ने 1.24 लाख नए पदों को मंजूरी दी है।']).slice(0, 3).join(' ')
const LH = 21
const run = (s, frames, obstacles = []) => {
  const r = flow(s, frames, obstacles, { font: '14px "Fake"', lineHeight: LH })
  assertAll(s, r, { frames, obstacles, lineHeight: LH, measure: fakeWidth })
  return r
}
const inFrame = (r, id) => r.lines.filter(l => l.frameId === id)

test('two-column story fills column a, then continues in column b', () => {
  const r = run(story, [{ id: 'a', x: 0, y: 0, w: 140, h: 210 }, { id: 'b', x: 160, y: 0, w: 140, h: 4000 }])
  assert.equal(inFrame(r, 'a').length, 10)
  assert.ok(inFrame(r, 'b').length > 0)
  assert.equal(r.remainder.trim(), '')
})

test('photo spanning both columns: no line in its band, text resumes below it', () => {
  const photo = { x: 0, y: 84, w: 300, h: 105, margin: 6 }
  const r = run(story, [{ id: 'a', x: 0, y: 0, w: 140, h: 600 }, { id: 'b', x: 160, y: 0, w: 140, h: 600 }], [photo])
  for (const id of ['a', 'b']) assert.ok(inFrame(r, id).some(l => l.y >= photo.y + photo.h + photo.margin), `frame ${id} has no line below the photo`)
})

test('photo in the middle of a column: lines beside it take the larger gap', () => {
  const photo = { x: 40, y: 63, w: 80, h: 84, margin: 6 }   // left gap 34, right gap 94
  const r = run(story, [{ id: 'a', x: 0, y: 0, w: 220, h: 4000 }], [photo])
  const beside = r.lines.filter(l => l.y < photo.y + photo.h + photo.margin && l.y + LH > photo.y - photo.margin)
  assert.ok(beside.length > 0)
  for (const l of beside) { assert.equal(l.x, photo.x + photo.w + photo.margin); assert.equal(l.w, 220 - l.x) }
})

test('story overflows into a third frame', () => {
  const frames = [{ id: 'a', x: 0, y: 0, w: 140, h: 105 }, { id: 'b', x: 160, y: 0, w: 140, h: 105 }, { id: 'c', x: 320, y: 0, w: 140, h: 4000 }]
  const r = run(story, frames)
  assert.equal(inFrame(r, 'a').length, 5); assert.equal(inFrame(r, 'b').length, 5)
  assert.ok(inFrame(r, 'c').length > 0)
  assert.equal(r.remainder.trim(), '')
})

test('empty frames: one too short for a line is skipped, one after the story ends stays empty', () => {
  const frames = [{ id: 'a', x: 0, y: 0, w: 140, h: 42 }, { id: 'short', x: 160, y: 0, w: 140, h: 15 }, { id: 'b', x: 320, y: 0, w: 140, h: 4000 }, { id: 'after', x: 480, y: 0, w: 140, h: 400 }]
  const r = run(story, frames)
  assert.equal(inFrame(r, 'short').length, 0)
  assert.ok(inFrame(r, 'b').length > 0)
  assert.equal(inFrame(r, 'after').length, 0)
  assert.equal(r.remainder.trim(), '')
})

test('beside a tall obstacle a word is not split when it fits the frame, but a word too long for the frame is', () => {
  const frame = { id: 'a', x: 0, y: 0, w: 220, h: 400 }
  const wall = { x: 0, y: 0, w: 150, h: 5000, margin: 4 }       // leaves a 66px gap: 9 fake letters
  const long10 = 'कखगघचछजझटठ'                                      // 70px: too wide for the gap, fits the frame
  const s1 = `अब तक ${long10} बस`
  const r1 = run(s1, [frame, { id: 'b', x: 240, y: 0, w: 220, h: 400 }], [wall])
  const words = new Set(s1.split(' '))
  for (const l of r1.lines) for (const w of l.text.trim().split(' ')) assert.ok(words.has(w), `"${w}" is a piece of a split word`)
  assert.ok(inFrame(r1, 'b').some(l => l.text.includes(long10)))
})

// D-020 revised: minimum usable gap beside an obstacle, word breaks only on grapheme cluster boundaries.
const { MIN_GAP_EM } = await import('../src/flow.js')
const MIN_GAP = MIN_GAP_EM * 14                                       // body size of '14px "Fake"'
const gapCase = gap => {
  const wall = { x: 0, y: 0, w: 220 - gap - 4, h: 105, margin: 4 }      // leaves exactly `gap` px beside it, rows 0-4
  return { wall, r: run(story, [{ id: 'a', x: 0, y: 0, w: 220, h: 400 }], [wall]) }
}

test('gap just below the minimum width: no text is set beside the obstacle', () => {
  const { wall, r } = gapCase(MIN_GAP - 1)
  assert.equal(r.lines.filter(l => l.y < wall.y + wall.h + wall.margin).length, 0)
  assert.ok(r.lines.length > 0)
})

test('gap just above the minimum width: text is set beside the obstacle', () => {
  const { wall, r } = gapCase(MIN_GAP + 1)
  const beside = r.lines.filter(l => l.y < wall.y + wall.h + wall.margin)
  assert.equal(beside.length, 6)
  for (const l of beside) assert.equal(l.w, MIN_GAP + 1)
})

test('long Hindi compound word beside a tall obstacle breaks only between grapheme clusters', () => {
  const compound = 'प्रधानमन्त्रीक्षेत्रविकासयोजनाश्रद्धाज्ञानपट्टीद्वारास्त्रीशिक्षा'
  const s = `अब ${compound} बस`
  const wall = { x: 0, y: 0, w: 110, h: 5000, margin: 4 }              // 106px gap: above the minimum
  const r = run(s, [{ id: 'a', x: 0, y: 0, w: 220, h: 400 }], [wall])
  assert.equal(r.remainder.trim(), '')
  assert.ok(r.lines.length > 2, 'the compound word was not broken')
  assert.equal(r.lines.map(l => l.text).join(''), s)
  const bounds = new Set([...new Intl.Segmenter('hi', { granularity: 'grapheme' }).segment(s)].map(g => g.index))
  let at = 0
  for (const l of r.lines) {
    assert.ok(bounds.has(at), `line "${l.text}" starts inside a grapheme cluster`)
    assert.ok(!/^\p{M}/u.test(l.text), `line "${l.text}" starts with a detached mark`)
    assert.ok(!/्$/.test(l.text.trimEnd()), `line "${l.text}" splits a conjunct after a halant`)
    at += l.text.length
  }
})

test('a word too long for the frame is not split into a gap below the minimum: it lands intact in the next frame or in the remainder', () => {
  const wall = { x: 0, y: 0, w: 150, h: 5000, margin: 4 }              // leaves a 66px gap, below MIN_GAP
  const word = 'क'.repeat(40)                                          // 280px: wider than the 220px frame
  const s = `अब ${word} बस`
  const r1 = run(s, [{ id: 'a', x: 0, y: 0, w: 220, h: 400 }], [wall])
  assert.equal(r1.lines.length, 0, 'text was set in a gap below the minimum')
  assert.equal(r1.remainder, s)
  const r2 = run(s, [{ id: 'a', x: 0, y: 0, w: 220, h: 400 }, { id: 'b', x: 240, y: 0, w: 300, h: 400 }], [wall])
  assert.equal(inFrame(r2, 'a').length, 0, 'text was set in a gap below the minimum')
  assert.ok(inFrame(r2, 'b').some(l => l.text.trim() === word), 'the long word was split')
  assert.equal(r2.remainder.trim(), '')
})

// D-025: deadGaps reports space beside obstacles that flow() leaves empty on purpose. Placement must not change.
const { placementCases, OPTS } = await import('./helpers/placement-cases.js')
const { createHash } = await import('node:crypto')
const col = { id: 'a', x: 0, y: 0, w: 220, h: 400 }

test('deadGaps: a photo leaving a 55px gap gives one below-min-gap rectangle over exactly the rows beside it', () => {
  const photo = { x: 0, y: 0, w: 220 - 55 - 4, h: 105, margin: 4 }    // blocks y 0-109: rows 0, 21, ... 105
  const r = run(story, [col], [photo])
  assert.deepEqual(r.deadGaps, [{ frame: 'a', x: 165, y: 0, width: 55, height: 6 * LH, reason: 'below-min-gap' }])
})

test('deadGaps: a photo mid-column with gaps on both sides gives one smaller-side rectangle', () => {
  const photo = { x: 40, y: 63, w: 80, h: 84, margin: 6 }            // gaps 0-34 and 126-220; blocks y 57-153: rows 42 ... 147
  const r = run(story, [{ ...col, h: 4000 }], [photo])
  assert.deepEqual(r.deadGaps, [{ frame: 'a', x: 0, y: 42, width: 34, height: 6 * LH, reason: 'smaller-side' }])
})

test('deadGaps: a photo snapped to the column edge leaves none', () => {
  assert.deepEqual(run(story, [col], [{ x: 0, y: 0, w: 100, h: 105, margin: 0 }]).deadGaps, [])
  assert.deepEqual(run(story, [col], [{ x: 0, y: 84, w: 220, h: 105, margin: 4 }]).deadGaps, [])
})

test('deadGaps: rows left empty only because the story ran out are not reported', () => {
  const photo = { x: 0, y: 210, w: 220 - 55 - 4, h: 63, margin: 4 }  // 55px gap well below the end of the short story
  const short = run('अब तक बस', [col], [photo])
  assert.equal(short.lines.length, 1)
  assert.deepEqual(short.deadGaps, [])
  assert.equal(run(story, [col], [photo]).deadGaps.length, 1, 'the same gap is reported when text continues past it')
})

test('placement (lines, remainder) is identical to flow() before deadGaps, on the existing cases', () => {
  const want = JSON.parse(fs.readFileSync(path.join(here, 'fixtures/flow-placement.json'), 'utf8'))
  for (const [name, s, frames, obstacles] of placementCases(story)) {
    const { lines, remainder } = flow(s, frames, obstacles, OPTS)
    const got = createHash('sha256').update(JSON.stringify({ lines, remainder })).digest('hex').slice(0, 16) + ` ${lines.length} lines`
    assert.equal(got, want[name], `placement changed: ${name}`)
  }
})
