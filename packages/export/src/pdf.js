import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const tool = fileURLToPath(new URL('./pdf-tool.py', import.meta.url))
export function runStrict(command, args, { allowOutput = false } = {}) {
  const result = spawnSync(command, args, { encoding: 'utf8', windowsHide: true, timeout: 120000, maxBuffer: 64 * 1024 * 1024 })
  if (result.error || result.status !== 0) throw new Error(`${path.basename(command)} failed (exit ${result.status}): ${result.error?.message ?? ''} ${result.stderr ?? ''} ${result.stdout ?? ''}`)
  if (result.stderr?.trim() || (!allowOutput && result.stdout?.trim())) throw new Error(`${path.basename(command)} diagnostic: ${result.stderr} ${result.stdout}`)
  return result.stdout
}
const python = args => JSON.parse(runStrict(process.env.PYTHON || 'python', [tool, ...args], { allowOutput: true }))
export const inspectPdf = file => python(['inspect', file])
export const setPageBoxes = (source, output, page) => python(['boxes', source, output, String(page.w * 72 / 25.4), String(page.h * 72 / 25.4)])
export function rewriteNeutralPdf(source, output, profile) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'neutral-rewrite-'))
  try {
    const config = path.join(dir, 'profile.json'); fs.writeFileSync(config, JSON.stringify(profile))
    return python(['rewrite', source, output, config])
  } finally { fs.rmSync(dir, { recursive: true, force: true }) }
}
export function findGhostscript() {
  const candidates = [process.env.GS]
  if (process.platform === 'win32') {
    const parent = path.join(process.env.ProgramFiles || 'C:/Program Files', 'gs')
    if (fs.existsSync(parent)) for (const dir of fs.readdirSync(parent).sort().reverse()) candidates.push(path.join(parent, dir, 'bin/gswin64c.exe'))
  }
  candidates.push('gswin64c', 'gs')
  for (const candidate of candidates.filter(Boolean)) {
    const r = spawnSync(candidate, ['-v'], { encoding: 'utf8', windowsHide: true, timeout: 10000 })
    if (!r.error && r.status === 0) return candidate
  }
  throw new Error('Ghostscript is not installed; set GS to its executable')
}
export function defaultIcc(pageMode, gs = findGhostscript()) {
  const name = pageMode === 'mono' ? 'default_gray.icc' : 'default_cmyk.icc'
  const candidates = [path.resolve(path.dirname(gs), '../iccprofiles', name), `/usr/share/color/icc/ghostscript/${name}`]
  for (const file of candidates) if (fs.existsSync(file)) return file
  return null
}
const psString = value => '(' + String(value).replace(/\\/g, '/').replace(/[()\\]/g, c => '\\' + c) + ')'
export function convertPdf(source, output, profile) {
  const gs = findGhostscript(), dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gs-export-'))
  try {
    if (profile.pdfx && profile.pdfx !== 'PDF/X-3:2002') throw new Error('pdfx target unsupported by installed Ghostscript integration; use PDF/X-3:2002 or null')
    const icc = profile.iccProfile || defaultIcc(profile.pageMode, gs)
    if (profile.pdfx && !icc) throw new Error('iccProfile is required for PDF/X output')
    const args = ['-q', '-dNOPAUSE', '-dBATCH', '-dSAFER', '-sDEVICE=pdfwrite', '-dAutoRotatePages=/None',
      `-sColorConversionStrategy=${profile.pageMode === 'mono' ? 'Gray' : 'CMYK'}`,
      `-sProcessColorModel=${profile.pageMode === 'mono' ? 'DeviceGray' : 'DeviceCMYK'}`,
      '-dEmbedAllFonts=true', '-dSubsetFonts=true', '-dPreserveDeviceN=false', '-dPassThroughJPEGImages=false',
      '-dPassThroughJPXImages=false', '-dDownsampleColorImages=true', '-dDownsampleGrayImages=true',
      `-dColorImageResolution=${profile.imageDpi}`, `-dGrayImageResolution=${profile.imageDpi}`,
      '-dColorImageDownsampleType=/Bicubic', '-dGrayImageDownsampleType=/Bicubic',
      '-dAutoFilterColorImages=false', '-dColorImageFilter=/FlateEncode', '-dAutoFilterGrayImages=false', '-dGrayImageFilter=/FlateEncode',
      '-dDownsampleMonoImages=false',
      `-sOutputFile=${output}`]
    if (icc) args.push(`--permit-file-read=${icc}`, `-sOutputICCProfile=${icc}`)
    if (profile.pdfx) {
      const definition = path.join(dir, 'PDFX.ps')
      const text = `%!\n[ /GTS_PDFXVersion (PDF/X-3:2002) /Title (Studio newspaper export) /Trapped /False /DOCINFO pdfmark\n` +
        `[ /_objdef {ExportICC} /type /stream /OBJ pdfmark\n[{ExportICC} << /N ${profile.pageMode === 'mono' ? 1 : 4} >> /PUT pdfmark\n` +
        `[{ExportICC} ${psString(icc)} (r) file /PUT pdfmark\n` +
        `[ /_objdef {ExportIntent} /type /dict /OBJ pdfmark\n[{ExportIntent} << /Type /OutputIntent /S /GTS_PDFX /OutputConditionIdentifier ${psString(path.basename(icc))} /Info (Provisional output profile) /DestOutputProfile {ExportICC} >> /PUT pdfmark\n` +
        `[{Catalog} << /OutputIntents [ {ExportIntent} ] >> /PUT pdfmark\n`
      fs.writeFileSync(definition, text)
      args.push('-dPDFX', '-dCompatibilityLevel=1.3', `--permit-file-read=${icc}`, definition)
    }
    args.push(source)
    runStrict(gs, args)
    return { ghostscript: runStrict(gs, ['-v'], { allowOutput: true }).trim(), iccProfile: icc, pdfxRequested: profile.pdfx ?? null }
  } finally { fs.rmSync(dir, { recursive: true, force: true }) }
}
