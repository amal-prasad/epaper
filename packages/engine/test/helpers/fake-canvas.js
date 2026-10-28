// Deterministic fake canvas so engine tests run in plain Node: no browser, no fonts, no flakiness.
// Every base letter is 7px wide; Devanagari combining marks, halant, ZWJ and ZWNJ add nothing.
// This proves the LOGIC (nothing lost, nothing overlaps, deterministic). Real font accuracy is the parity harness's job.
const COMBINING = /[ऀ-ंऺ़ु-ै्॑-ॗॢॣ‌‍]/

export const CHAR_W = 7
export function fakeWidth(text) {
  let n = 0
  for (const ch of text) if (!COMBINING.test(ch)) n++
  return n * CHAR_W
}

export function installFakeCanvas() {
  if (globalThis.__fakeCanvasInstalled) return
  globalThis.OffscreenCanvas = class {
    getContext() { return { font: '', measureText: t => ({ width: fakeWidth(t) }) } }
  }
  globalThis.__fakeCanvasInstalled = true
}
