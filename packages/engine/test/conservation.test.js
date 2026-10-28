// Runs the invariants against the real flow() once Phase 0 task 5 creates packages/engine/src/flow.js.
// Until then every test here is reported as skipped (not passed). Contract: see docs/TESTING.md.
import test from 'node:test'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { installFakeCanvas, fakeWidth } from './helpers/fake-canvas.js'
import { assertAll, assertDeterministic, assertConserved } from './helpers/invariants.js'
import { rng, int } from './helpers/fuzz.js'

const here = path.dirname(fileURLToPath(import.meta.url))
const flowPath = path.join(here, '../src/flow.js')
const have = fs.existsSync(flowPath)
const skip = have ? false : 'flow.js not built yet (Phase 0 task 5)'
installFakeCanvas()
const flow = have ? (await import(pathToFileURL(flowPath).href)).flow : null

// real Hindi copy if present, else a small built-in sample
const samplesDir = path.join(here, '../../../spike/samples')
const real = fs.existsSync(samplesDir) ? fs.readdirSync(samplesDir).filter(f => f.endsWith('.txt'))
  .flatMap(f => fs.readFileSync(path.join(samplesDir, f), 'utf8').split(/\n\s*\n/)).map(s => s.replace(/\s+/g, ' ').trim()).filter(s => s.length > 40) : []
const paras = real.length ? real : ['मध्य प्रदेश में सरकारी नौकरी की तैयारी कर रहे युवाओं के लिए बड़ी खबर है। मुख्यमंत्री डॉ. मोहन यादव के नेतृत्व वाली सरकार ने 1.24 लाख नए पदों को मंजूरी दी है।']
const story = paras.slice(0, 6).join(' ')
const OPTS = { font: '14px "Fake"', lineHeight: 21 }
const run = (s, frames, obstacles = []) => flow(s, frames, obstacles, OPTS)
const check = (s, frames, obstacles = []) => assertAll(s, run(s, frames, obstacles), { frames, obstacles, lineHeight: 21, measure: fakeWidth })

test('one tall frame holds everything', { skip }, () => check(story, [{ id: 'a', x: 0, y: 0, w: 200, h: 4000 }]))
test('two columns', { skip }, () => check(story, [{ id: 'a', x: 0, y: 0, w: 140, h: 210 }, { id: 'b', x: 160, y: 0, w: 140, h: 4000 }]))
test('photo in the middle of a column', { skip }, () => check(story, [{ id: 'a', x: 0, y: 0, w: 220, h: 4000 }], [{ x: 60, y: 63, w: 80, h: 84, margin: 6 }]))
test('photo spanning two columns', { skip }, () => check(story, [{ id: 'a', x: 0, y: 0, w: 140, h: 600 }, { id: 'b', x: 160, y: 0, w: 140, h: 600 }], [{ x: 0, y: 84, w: 300, h: 105, margin: 6 }]))
test('story longer than the frames overflows into remainder', { skip }, () => {
  const frames = [{ id: 'a', x: 0, y: 0, w: 140, h: 105 }]
  const res = run(story, frames); assertAll(story, res, { frames, lineHeight: 21, measure: fakeWidth })
  if (!res.remainder || !res.remainder.trim()) throw new Error('expected overflow')
})
test('no frames: everything is remainder', { skip }, () => assertConserved(story, run(story, [])))
test('empty story: no lines', { skip }, () => { const r = run('', [{ id: 'a', x: 0, y: 0, w: 100, h: 100 }]); if (r.lines.length) throw new Error('lines for empty story') })
test('frame too narrow for one letter does not hang or lose text', { skip }, () => assertConserved(story.slice(0, 80), run(story.slice(0, 80), [{ id: 'a', x: 0, y: 0, w: 3, h: 2000 }])))
test('obstacle taller than the column', { skip }, () => check(story, [{ id: 'a', x: 0, y: 0, w: 220, h: 400 }], [{ x: 0, y: 0, w: 120, h: 5000, margin: 4 }]))
test('deterministic', { skip }, () => assertDeterministic(() => run(story, [{ id: 'a', x: 0, y: 0, w: 140, h: 400 }])))
test('fuzz: random frames and obstacles, 300 seeds', { skip }, () => {
  const only = process.env.FUZZ_SEED ? Number(process.env.FUZZ_SEED) : null
  for (let seed = only ?? 1; seed <= (only ?? 300); seed++) {
    const r = rng(seed)
    const frames = Array.from({ length: int(r, 1, 4) }, (_, i) => ({ id: 'f' + i, x: i * 170, y: 0, w: int(r, 30, 160), h: int(r, 20, 500) }))
    const obstacles = Array.from({ length: int(r, 0, 3) }, () => ({ x: int(r, 0, 500), y: int(r, 0, 300), w: int(r, 10, 120), h: int(r, 10, 200), margin: int(r, 0, 8) }))
    const s = paras[int(r, 0, paras.length - 1)]
    try { check(s, frames, obstacles) } catch (e) { e.message = `[fuzz seed ${seed}] ${e.message}`; throw e }
  }
})
test('a story that fits leaves no remainder', { skip }, () => {
  const r = run(story, [{ id: 'a', x: 0, y: 0, w: 200, h: 4000 }])
  if ((r.remainder ?? '').trim()) throw new Error(`remainder should be empty, got ${r.remainder.length} characters`)
  if (!r.lines.length) throw new Error('no lines placed')
})
