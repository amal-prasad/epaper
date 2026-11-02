import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { assertPreset } from '../../engine/src/preset.js'

const fail = message => { throw new Error(`export settings: ${message}`) }
const required = ['id', 'colourRoute', 'bleed', 'cropMarks', 'inkLimit', 'pageMode', 'overprint', 'neutralCurve', 'imageDpi', 'minImageDpi']

// Publication values take precedence over reusable defaults. Null means unresolved, not zero/false.
// The result is plain data and an independent snapshot; callers store it with the exported issue.
export function resolveExportSettings(preset, outputProfile, { mode = 'development', baseDir = process.cwd() } = {}) {
  if (!['development', 'press'].includes(mode)) fail(`mode ${mode} is unsupported`)
  assertPreset(preset)
  if (!outputProfile || typeof outputProfile !== 'object' || Array.isArray(outputProfile)) fail('profile is missing')
  const profile = structuredClone(outputProfile), assumptions = preset.assumed.map(key => `preset.${key}`)
  const overridden = new Set()
  for (const [key, value] of Object.entries(preset.exportProfile)) if (value != null) {
    profile[key] = structuredClone(value); overridden.add(key)
  }
  for (const field of required) if (profile[field] == null) fail(`profile.${field} is missing`)
  if (typeof profile.id !== 'string' || !profile.id.trim()) fail('profile.id is missing')
  if (!Array.isArray(profile.assumed ?? [])) fail('profile.assumed must be a list')
  for (const key of profile.assumed ?? []) if (!overridden.has(key)) assumptions.push(`profile.${key}`)
  if (!['colour', 'mono'].includes(profile.pageMode)) fail('profile.pageMode must be colour or mono')
  if (!['neutral-rgb-to-k-cmyk', 'gray'].includes(profile.colourRoute)) fail('profile.colourRoute is unsupported')
  if ((profile.pageMode === 'mono') !== (profile.colourRoute === 'gray')) fail('profile.colourRoute does not match pageMode')
  if (!Number.isFinite(profile.bleed) || profile.bleed < 0) fail('profile.bleed must be zero or greater')
  if (typeof profile.cropMarks !== 'boolean') fail('profile.cropMarks must be boolean')
  if (!Number.isFinite(profile.inkLimit) || profile.inkLimit <= 0 || profile.inkLimit > 400) fail('profile.inkLimit must be in (0, 400]')
  for (const field of ['imageDpi', 'minImageDpi'])
    if (!Number.isFinite(profile[field]) || profile[field] <= 0) fail(`profile.${field} must be positive`)
  if (profile.minImageDpi > profile.imageDpi) fail('profile.minImageDpi exceeds imageDpi')
  if (profile.overprint !== false) fail('profile.overprint is unsupported; currently use knockout (false)')
  const curve = profile.neutralCurve
  if (!Array.isArray(curve) || curve.length < 2 || curve.some((pair, i) =>
    !Array.isArray(pair) || pair.length !== 2 || pair.some(n => !Number.isFinite(n) || n < 0 || n > 1) ||
    (i && (pair[0] <= curve[i - 1][0] || pair[1] < curve[i - 1][1]))) ||
    curve[0][0] !== 0 || curve[0][1] !== 0 || curve.at(-1)[0] !== 1) fail('profile.neutralCurve must monotonically map [0,1], preserving white')
  if (profile.pdfx != null && !['PDF/X-1a:2001', 'PDF/X-3:2002'].includes(profile.pdfx)) fail('profile.pdfx is unsupported')
  let icc = null
  if (profile.iccProfile != null) {
    const file = path.resolve(baseDir, profile.iccProfile)
    let bytes
    try { bytes = fs.readFileSync(file) } catch { fail(`profile.iccProfile is unreadable: ${file}`) }
    if (bytes.length < 132 || bytes.toString('ascii', 36, 40) !== 'acsp' || bytes.readUInt32BE(0) !== bytes.length)
      fail('profile.iccProfile has an invalid ICC header')
    const colourSpace = bytes.toString('ascii', 16, 20).trim()
    if (colourSpace !== (profile.pageMode === 'colour' ? 'CMYK' : 'GRAY')) fail('profile.iccProfile colour space does not match pageMode')
    profile.iccProfile = file
    icc = { path: file, sha256: crypto.createHash('sha256').update(bytes).digest('hex'), colourSpace }
  } else assumptions.push('profile.iccProfile')
  if (mode === 'press' && (assumptions.length || !icc)) fail(`unconfirmed assumptions: ${assumptions.join(', ')}`)
  return {
    mode, page: structuredClone(preset.page), margins: structuredClone(preset.margins), grid: structuredClone(preset.grid),
    pageCount: structuredClone(preset.pageCount), profile, icc,
    assumptions: [...new Set(assumptions)], pressAccepted: false,
    certification: { requested: profile.pdfx ?? null, status: 'pending' },
  }
}
