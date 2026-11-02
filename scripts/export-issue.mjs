import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { exportIssue } from '../packages/export/src/export.js'

const root = fileURLToPath(new URL('../', import.meta.url))
const args = process.argv.slice(2), input = args.shift(), flags = {}
try {
  if (!input || input.startsWith('--')) throw new Error('Usage: node scripts/export-issue.mjs issue.json --out NEW_DIRECTORY [--profile PROFILE.json] [--mode development]')
  while (args.length) {
    const key = args.shift(), value = args.shift()
    if (!['--out', '--profile', '--mode'].includes(key) || !value || value.startsWith('--') || key in flags) throw new Error(`invalid or duplicate argument: ${key}`)
    flags[key] = value
  }
  if (!flags['--out']) throw new Error('--out NEW_DIRECTORY is required; existing directories are never overwritten')
  const issuePath = path.resolve(input), profilePath = path.resolve(flags['--profile'] ?? path.join(root, 'presets/output/development-colour.json'))
  const doc = JSON.parse(fs.readFileSync(issuePath, 'utf8')), profile = JSON.parse(fs.readFileSync(profilePath, 'utf8'))
  // ICC paths belong to the output profile; asset paths belong to the issue document.
  if (profile.iccProfile) profile.iccProfile = path.resolve(path.dirname(profilePath), profile.iccProfile)
  const report = await exportIssue(doc, profile, flags['--out'], { mode: flags['--mode'] ?? 'development', assetRoot: path.dirname(issuePath) })
  console.log(`Exported ${report.pages} page(s) to ${path.resolve(flags['--out'])}`)
  console.log(`Checks passed; maximum ink ${report.plates.totalInkMaxPct}%; PDF/X independent validation pending; provisional settings listed in report.json.`)
} catch (error) { console.error(error.message); process.exitCode = 1 }
