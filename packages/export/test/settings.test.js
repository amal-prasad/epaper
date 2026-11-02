import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { resolveExportSettings } from '../src/settings.js'

const preset = () => JSON.parse(fs.readFileSync(new URL('../../../presets/newspaper.json', import.meta.url), 'utf8'))
const profile = () => ({ id: 'working-colour', colourRoute: 'neutral-rgb-to-k-cmyk', pdfx: null,
  bleed: 0, cropMarks: false, iccProfile: null, inkLimit: 240, pageMode: 'colour',
  overprint: false, neutralCurve: [[0, 0], [1, 1]], imageDpi: 300, minImageDpi: 150,
  assumed: ['inkLimit', 'bleed', 'cropMarks', 'overprint', 'neutralCurve'] })

test('resolves provisional settings without mutating publication or reusable profile', () => {
  const p = preset(), output = profile(), before = JSON.stringify({ p, output })
  const result = resolveExportSettings(p, output)
  assert.equal(result.page.w, 297)
  assert.equal(result.profile.bleed, 0)
  assert.equal(result.profile.cropMarks, false)
  assert.equal(result.profile.inkLimit, 240)
  assert.ok(result.assumptions.includes('preset.page'))
  assert.ok(result.assumptions.includes('profile.inkLimit'))
  assert.equal(result.pressAccepted, false)
  result.page.w = 100
  result.profile.neutralCurve[0][0] = 0.1
  assert.equal(JSON.stringify({ p, output }), before)
})

test('explicit preset values override provisional defaults, preserving zero and false', () => {
  const p = preset(); p.exportProfile.inkLimit = 220; p.exportProfile.cropMarks = false
  const defaults = profile(); defaults.cropMarks = true
  const result = resolveExportSettings(p, defaults)
  assert.equal(result.profile.inkLimit, 220)
  assert.equal(result.profile.cropMarks, false)
  assert.ok(!result.assumptions.includes('profile.inkLimit'))
})

test('two publication sizes and colour/mono configurations stay independent', () => {
  const a = preset(), b = preset(); b.page = { w: 250, h: 380 }; b.grid.cols = 5
  b.exportProfile.colourRoute = null
  const mono = profile(); mono.id = 'working-mono'; mono.pageMode = 'mono'; mono.colourRoute = 'gray'
  const first = resolveExportSettings(a, profile()), second = resolveExportSettings(b, mono)
  assert.deepEqual(second.page, { w: 250, h: 380 })
  assert.equal(second.profile.colourRoute, 'gray')
  assert.equal(first.profile.pageMode, 'colour')
  assert.equal(first.grid.cols, 6)
  assert.equal(second.grid.cols, 5)
})

for (const [field, value] of [['bleed', -1], ['bleed', Infinity], ['cropMarks', 'false'],
  ['inkLimit', 0], ['inkLimit', 401], ['imageDpi', 0], ['minImageDpi', -1],
  ['pageMode', 'rgb'], ['colourRoute', 'unknown'], ['pdfx', 'PDF/X-fake'], ['overprint', true]]) {
  test(`refuses invalid or unsupported profile.${field} = ${value}`, () => {
    const output = profile(); output[field] = value
    const p = preset(); p.exportProfile[field] = value
    assert.throws(() => resolveExportSettings(p, output), new RegExp(field))
  })
}

test('rejects colour and mono route mismatch', () => {
  const output = profile(); output.colourRoute = 'gray'
  const p = preset(); p.exportProfile.colourRoute = null
  assert.throws(() => resolveExportSettings(p, output), /colourRoute/)
})

test('missing reusable profile and incomplete settings are named', () => {
  assert.throws(() => resolveExportSettings(preset(), null), /profile/)
  const output = profile(); delete output.inkLimit
  assert.throws(() => resolveExportSettings(preset(), output), /inkLimit/)
})

test('missing ICC file is rejected before conversion', () => {
  const output = profile(); output.iccProfile = 'no-such-profile.icc'
  assert.throws(() => resolveExportSettings(preset(), output), /iccProfile/)
})

test('reads ICC header and records its identity; arbitrary file is not a profile', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'export-profile-'))
  try {
    const file = path.join(dir, 'fixture.icc'), output = profile(); output.iccProfile = file
    fs.writeFileSync(file, 'not an ICC profile')
    assert.throws(() => resolveExportSettings(preset(), output), /iccProfile/)
    const data = Buffer.alloc(132); data.writeUInt32BE(132); data.write('CMYK', 16); data.write('acsp', 36)
    fs.writeFileSync(file, data)
    const result = resolveExportSettings(preset(), output)
    assert.equal(result.icc.colourSpace, 'CMYK')
    assert.match(result.icc.sha256, /^[a-f0-9]{64}$/)
  } finally { fs.rmSync(dir, { recursive: true, force: true }) }
})

test('press mode reports unconfirmed settings and missing ICC instead of inventing acceptance', () => {
  assert.throws(() => resolveExportSettings(preset(), profile(), { mode: 'press' }), /assum|iccProfile/)
})

test('invalid page geometry is refused', () => {
  const p = preset(); p.page.w = -1
  assert.throws(() => resolveExportSettings(p, profile()), /page/)
})

test('output profile is serialized as an issue snapshot', () => {
  const result = resolveExportSettings(preset(), profile())
  assert.deepEqual(JSON.parse(JSON.stringify(result)), result)
})

test('unavailable PDF/X certification is explicit in development settings', () => {
  const output = profile(); output.pdfx = 'PDF/X-1a:2001'
  const result = resolveExportSettings(preset(), output)
  assert.equal(result.certification.status, 'pending')
  assert.equal(result.certification.requested, 'PDF/X-1a:2001')
})

test('unknown resolution mode is refused', () => {
  assert.throws(() => resolveExportSettings(preset(), profile(), { mode: 'production-ish' }), /mode/)
})
