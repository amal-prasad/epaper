import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { renderIssue } from './render.js'
import { resolveExportSettings } from './settings.js'
import { rewriteNeutralPdf, setPageBoxes, convertPdf, inspectPdf, defaultIcc } from './pdf.js'
import { checkPlates } from './plates.js'

const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex')
export async function exportIssue(document, outputProfile, destination, options = {}) {
  const output = path.resolve(destination), parent = path.dirname(output)
  if (fs.existsSync(output)) throw new Error(`export destination exists; choose a new version directory: ${output}`)
  const defaults = structuredClone(outputProfile)
  if (defaults.iccProfile == null) {
    defaults.iccProfile = defaultIcc(defaults.pageMode)
    defaults.assumed = [...new Set([...(defaults.assumed ?? []), 'iccProfile'])]
  }
  const settings = resolveExportSettings(document.preset, defaults, { mode: options.mode ?? 'development', baseDir: options.assetRoot ?? process.cwd() })
  if (settings.profile.bleed !== 0) throw new Error('bleed is not implemented for positioned export yet; use provisional zero bleed')
  if (settings.profile.cropMarks !== false) throw new Error('cropMarks are not implemented for positioned export yet; use false')
  if (settings.profile.pageMode === 'mono' && settings.profile.neutralCurve.some(([x, y]) => x !== y))
    throw new Error('neutralCurve: custom mono curves are not implemented; use the provisional identity curve')
  if (settings.mode === 'press') throw new Error('independent PDF/X validation and physical press acceptance are pending; use development mode')
  fs.mkdirSync(parent, { recursive: true })
  const work = fs.mkdtempSync(path.join(parent, '.export-'))
  try {
    const rendered = await renderIssue(document, { assetRoot: options.assetRoot, minImageDpi: settings.profile.minImageDpi })
    const raw = path.join(work, 'intermediate.pdf'), boxed = path.join(work, 'boxed.pdf'), rewritten = path.join(work, 'neutral.pdf'), final = path.join(work, 'issue.pdf')
    fs.writeFileSync(raw, rendered.pdf)
    setPageBoxes(raw, boxed, settings.page)
    let source = boxed, rewrite = { rewritten: 0 }
    if (settings.profile.pageMode === 'colour' && !options.diagnosticSkipRewrite) {
      rewrite = rewriteNeutralPdf(boxed, rewritten, settings.profile); source = rewritten
    }
    const conversion = convertPdf(source, final, settings.profile), info = inspectPdf(final)
    if (info.syntaxWarnings.length) throw new Error(`PDF syntax diagnostics: ${info.syntaxWarnings.join('; ')}`)
    if (info.pages.length !== document.pages.length) throw new Error('PDF page count changed during conversion')
    for (const page of info.pages) for (const key of ['MediaBox', 'TrimBox', 'BleedBox']) {
      const box = page[key], expected = [0, 0, settings.page.w * 72 / 25.4, settings.page.h * 72 / 25.4]
      if (box.length !== 4 || box.some((v, i) => Math.abs(v - expected[i]) > 0.1)) throw new Error(`PDF ${key} does not match the resolved page size: ${JSON.stringify(box)}, expected ${JSON.stringify(expected)}`)
    }
    const hasText = document.stories.some(s => s.body.some(t => t.trim())) || document.pages.some(p => p.objects.some(o => typeof o.text === 'string' && o.text.trim()))
    if (hasText && !info.fonts.length || info.fonts.some(f => !f.embedded || !f.subset)) throw new Error('PDF fonts are missing, unembedded or not subset')
    if (info.colours.some(c => ['rg', 'RG', 'unknown', 'UNKNOWN'].includes(c.operator)) || info.images.some(i => !['/DeviceCMYK', '/DeviceGray'].includes(i.colourSpace)))
      throw new Error('PDF retains an unsupported or RGB colour space')
    if (settings.profile.pageMode === 'mono' && (info.colours.some(c => ['k', 'K'].includes(c.operator)) || info.images.some(i => i.colourSpace !== '/DeviceGray')))
      throw new Error('mono PDF retains CMYK content')
    if (settings.profile.pdfx && (info.pdfx !== settings.profile.pdfx || !info.outputIntents.some(i => i.type === '/GTS_PDFX' && i.iccSha256 === settings.icc?.sha256)))
      throw new Error('PDF/X target metadata or output intent does not match the chosen profile')
    const plates = await checkPlates(final, rendered.pages, settings.profile, work)
    // Keep compact PNG previews and the PDF/report; raw uncompressed raster scratch files are not deliverables.
    for (const file of fs.readdirSync(work)) if (/^plate-\d+.*\.tif$/.test(file)) fs.unlinkSync(path.join(work, file))
    const report = { status: 'checked-development', stage: 'converted', created: new Date().toISOString(),
      inputSha256: hash(JSON.stringify(document)), outputSha256: hash(fs.readFileSync(final)), pages: info.pages.length,
      settings, conversion, rewrite, pdf: info, plates,
      certification: { requested: settings.profile.pdfx, status: 'independent-validation-pending' },
      pressAccepted: false, chromiumVersion: rendered.chromiumVersion }
    fs.writeFileSync(path.join(work, 'source.json'), JSON.stringify(document, null, 2) + '\n')
    if (settings.icc) fs.copyFileSync(settings.icc.path, path.join(work, 'output-profile.icc'))
    fs.writeFileSync(path.join(work, 'report.json'), JSON.stringify(report, null, 2) + '\n')
    for (const [i, page] of rendered.pages.entries()) {
      fs.writeFileSync(path.join(work, `screen-${i + 1}.png`), page.screenshot)
      fs.writeFileSync(path.join(work, `neutral-mask-${i + 1}.png`), page.neutralMask)
    }
    // The whole checked bundle becomes visible together; existing versions are never overwritten.
    fs.renameSync(work, output)
    return report
  } finally {
    if (path.dirname(work) === parent && path.basename(work).startsWith('.export-') && fs.existsSync(work)) fs.rmSync(work, { recursive: true, force: true })
  }
}
