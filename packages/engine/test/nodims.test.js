// Mutation check for gate G1.nodims: a hardcoded page size put in engine source must make the gate's script count a hit.
// What the script does not catch yet is listed in docs/GATE_GAPS.md (GG-049).
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
const script = path.join(root, 'scripts/check-page-dims.mjs'), metric = path.join(root, 'spike/out/nodims.json')
const run = (...args) => {
  const out = spawnSync(process.execPath, [script, ...args], { cwd: root, encoding: 'utf8' })
  assert.equal(out.status, 0, out.stderr)
  return JSON.parse(fs.readFileSync(metric, 'utf8')).hits
}
function hitsFor(source) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nodims-'))
  try {
    fs.writeFileSync(path.join(dir, 'planted.js'), source + '\n')
    return run(dir)
  } finally { fs.rmSync(dir, { recursive: true, force: true }) }
}

const CAUGHT = {
  'page size in mm': 'export const page = { w: 297, h: 420 }',
  'paper name': "const paper = 'A3'",
  'page width in pt': 'const w = 841.89',
  'page width in CSS px': 'const w = 1122.52',
  'another paper name': "const paper = 'tabloid'",
  'a listed size inside a sum': 'const w = 148 * 2',
  'custom size as w and h': 'const page = { w: 330, h: 483 }',
  'custom size, h first': 'const box = { h: 578, w: 380 }',
  'custom size as width and height': 'const box = { width: 330, height: 483 }',
  'number with a unit in a CSS string': "const s = '@page{size:297mm 420mm}'",
  'decimal form': 'const w = 297.0',
  'a named page dimension': 'const pageWidth = 330',
  'a named trim size': 'const TRIM_H = 483',
  'the size in a preset file': `const w = ${JSON.parse(fs.readFileSync(path.join(root, 'presets/newspaper.json'), 'utf8')).page.w}`,
}

const ALLOWED = {
  'a size named only in a comment': '// the page is A3, 297 by 420',
  'w and h from variables': 'const box = { w: width, h: height }',
  'reading a page size from the preset': 'const w = preset.page.w',
  'a page number': 'const no = page.no + 1',
  'a small number unrelated to page size': 'const LIMIT = 72',
}

test('G1.nodims counts a hardcoded page size', async t => {
  try {
    for (const [name, source] of Object.entries(CAUGHT)) await t.test(name, () => assert.ok(hitsFor(source) >= 1, source))
    for (const [name, source] of Object.entries(ALLOWED)) await t.test(`does not count: ${name}`, () => assert.equal(hitsFor(source), 0, source))
    await t.test('the real engine source has none', () => assert.equal(run(), 0))
  } finally { run() }   // leaves the metric file describing the real engine
})
