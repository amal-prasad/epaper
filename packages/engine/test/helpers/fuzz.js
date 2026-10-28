// Seeded fuzzing: apply random operations, then undo them all; the document must be exactly as it started.
// Failures print the seed, so any failure can be replayed with FUZZ_SEED=<n>.
import assert from 'node:assert/strict'

export function rng(seed) {                                  // mulberry32
  let a = seed >>> 0
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
}
export const pick = (r, arr) => arr[Math.floor(r() * arr.length)]
export const int = (r, lo, hi) => lo + Math.floor(r() * (hi - lo + 1))

// ops: [{ name, gen(r, doc) -> args | null, apply(doc, args) -> { doc, inverse } }]
//   `inverse` is a function (doc) -> doc that undoes this op. apply must not mutate its input.
export function fuzzUndo({ makeDoc, ops, steps = 40, runs = 200, clone = d => structuredClone(d) }) {
  const base = process.env.FUZZ_SEED ? Number(process.env.FUZZ_SEED) : 1
  for (let run = 0; run < runs; run++) {
    const seed = process.env.FUZZ_SEED ? base : base + run
    const r = rng(seed)
    const start = makeDoc(r), startCopy = clone(start)
    let doc = start; const undo = []
    try {
      for (let s = 0; s < steps; s++) {
        const op = pick(r, ops), args = op.gen(r, doc)
        if (args == null) continue
        const out = op.apply(doc, args)
        doc = out.doc; undo.push({ name: op.name, inverse: out.inverse })
      }
      assert.deepEqual(start, startCopy, 'an op mutated its input document')
      while (undo.length) doc = undo.pop().inverse(doc)
      assert.deepEqual(doc, startCopy, 'undoing every op did not restore the starting document')
    } catch (e) { e.message = `[fuzz seed ${seed}] ${e.message}`; throw e }
    if (process.env.FUZZ_SEED) break
  }
}
