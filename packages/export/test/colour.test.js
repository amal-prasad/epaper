import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { rewriteNeutralPdf, inspectPdf, convertPdf, runStrict } from '../src/pdf.js'
import { checkPlates } from '../src/plates.js'

const helper = fileURLToPath(new URL('./pdf-fixture.py', import.meta.url))
const curve = [[0, 0], [1, 1]]
const fixture = (dir, kind) => {
  const file = path.join(dir, `${kind}.pdf`)
  execFileSync(process.env.PYTHON || 'python', [helper, file, kind])
  return file
}

test('structured rewrite preserves colour and white, maps black and tints to K, including forms', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'export-colour-'))
  try {
    for (const kind of ['basic', 'form', 'gray', 'spaces']) {
      const input = fixture(dir, kind), output = path.join(dir, `${kind}-rewrite.pdf`)
      const report = rewriteNeutralPdf(input, output, { neutralCurve: curve })
      assert.ok(report.rewritten >= 1)
      const info = inspectPdf(output)
      assert.deepEqual(info.syntaxWarnings, [])
      assert.ok(info.colours.some(c => c.operator === 'k' && c.values.at(-1) === 1))
      if (['basic', 'form'].includes(kind)) {
        assert.ok(info.colours.some(c => c.operator === 'k' && Math.abs(c.values.at(-1) - 0.15) < 0.001))
        assert.ok(info.colours.some(c => c.operator === 'rg' && c.values.join(',') === '1,1,1'))
        assert.ok(info.colours.some(c => c.operator === 'rg' && c.values.join(',') === '1,0,0'))
      }
    }
  } finally { fs.rmSync(dir, { recursive: true, force: true }) }
})

test('rewrite refuses unknown colour spaces and transparency rather than missing neutral text', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'export-unsupported-'))
  try {
    for (const kind of ['unsupported', 'alpha'])
      assert.throws(() => rewriteNeutralPdf(fixture(dir, kind), path.join(dir, 'out.pdf'), { neutralCurve: curve }), /unsupported|transparen/i)
  } finally { fs.rmSync(dir, { recursive: true, force: true }) }
})

test('Ghostscript colour and gray routes reuse the spike strategies without repair warnings', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'export-convert-'))
  try {
    const input = fixture(dir, 'basic'), rewritten = path.join(dir, 'rewritten.pdf')
    rewriteNeutralPdf(input, rewritten, { neutralCurve: curve })
    for (const pageMode of ['colour', 'mono']) {
      const output = path.join(dir, `${pageMode}.pdf`)
      convertPdf(pageMode === 'colour' ? rewritten : input, output, { pageMode, imageDpi: 300, pdfx: null })
      const info = inspectPdf(output)
      assert.deepEqual(info.syntaxWarnings, [])
      assert.ok(info.colours.length > 0)
      assert.ok(!info.colours.some(c => ['rg', 'RG'].includes(c.operator)))
      if (pageMode === 'mono') assert.ok(!info.colours.some(c => ['k', 'K'].includes(c.operator)))
    }
  } finally { fs.rmSync(dir, { recursive: true, force: true }) }
})

test('a zero-exit warning still fails; argument strings never run through a shell', () => {
  assert.throws(() => runStrict(process.execPath, ['-e', 'console.error("WARNING: repaired PDF")']), /WARNING/)
  assert.throws(() => runStrict(process.execPath, ['-e', 'process.exitCode = 2']), /exit|failed/i)
})

test('a tiny rich-black region cannot hide behind a large correct K region', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'thin-rich-'))
  try {
    const { createCanvas } = createRequire(new URL('../../../spike/package.json', import.meta.url))('@napi-rs/canvas')
    const canvas = createCanvas(267, 267), context = canvas.getContext('2d'), scale = 96 / 72
    context.fillStyle = 'white'; context.fillRect(0, 0, 267, 267); context.fillStyle = 'black'
    context.fillRect(10 * scale, 40 * scale, 150 * scale, 150 * scale)
    context.fillRect(170 * scale, 29 * scale, scale, scale)
    const report = { id: 'p1', neutralMask: canvas.toBuffer('image/png'), neutralMaskDpi: 96,
      neutralRegions: [{ id: 'large', x: 10 * scale, y: 40 * scale, w: 150 * scale, h: 150 * scale, k: 1 },
        { id: 'thin', x: 170 * scale, y: 29 * scale, w: scale, h: scale, k: 1 }] }
    await assert.rejects(checkPlates(fixture(dir, 'thin-rich'), [report], { inkLimit: 240, neutralCurve: curve }, dir), /neutral.*plate|region|coverage/i)
  } finally { fs.rmSync(dir, { recursive: true, force: true }) }
})
