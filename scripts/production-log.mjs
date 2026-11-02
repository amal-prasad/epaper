// Appends local operator assertions; never calls the harness recorder.
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { appendToFile, readLedger } from '../packages/production/src/store.js'
import { summarize } from '../packages/production/src/ledger.js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const usage = `Usage:
  node scripts/production-log.mjs append ISSUE.json [--ledger .local/production/real-issues.json]
  node scripts/production-log.mjs summary [--ledger .local/production/real-issues.json] [--json]
Local ledgers must stay under .local/production/. Synthetic issues need a separate ledger.
No harness evidence is written. See docs/production-log.md.`

async function destination(value) {
  const file = path.resolve(root, value)
  const allowed = path.join(root, '.local', 'production')
  const relative = path.relative(allowed, file)
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative) || path.extname(file) !== '.json')
    throw new Error('Ledger must be a .json file inside .local/production/; harness/results is never a destination')
  // Reject existing symlink/junction path components before any mkdir/write.
  const components = path.relative(root, file).split(path.sep)
  let current = root
  for (const component of components) {
    current = path.join(current, component)
    try { if ((await fs.lstat(current)).isSymbolicLink()) throw new Error('Ledger paths cannot contain symbolic links or junctions') }
    catch (error) { if (error.code !== 'ENOENT') throw error }
  }
  return file
}

async function main() {
  const [command, ...args] = process.argv.slice(2)
  if (command === '--help' || command === '-h') { console.log(usage); return }
  if (!['append', 'summary'].includes(command)) throw new Error(usage)
  const positionals = [], options = new Map()
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (arg === '--json' && command === 'summary' && !options.has(arg)) options.set(arg, true)
    else if (arg === '--ledger' && !options.has(arg) && args[i + 1] && !args[i + 1].startsWith('--')) options.set(arg, args[++i])
    else if (arg.startsWith('--')) throw new Error(`Unknown, repeated or incomplete option: ${arg}`)
    else positionals.push(arg)
  }
  if (positionals.length !== (command === 'append' ? 1 : 0)) throw new Error(usage)
  const file = await destination(options.get('--ledger') || '.local/production/real-issues.json')
  let ledger
  if (command === 'append') {
    const issue = JSON.parse(await fs.readFile(path.resolve(positionals[0]), 'utf8'))
    ledger = await appendToFile(file, issue)
    console.log(`Appended immutable issue ${JSON.stringify(issue.id)} to ${path.relative(root, file)} (${issue.kind}).`)
  } else ledger = await readLedger(file)
  const summary = summarize(ledger)
  if (options.get('--json')) { console.log(JSON.stringify(summary, null, 2)); return }
  console.log(`\n${summary.kind.toUpperCase()} operator-entered ledger; no gate recorded. Latest window: ${summary.windowIds.join(', ') || 'none'}`)
  console.table(summary.rows.map(row => ({ issue: row.id, publication: row.publication, paid: row.paid,
    pages: row.pageCount, elapsedMin: row.elapsedMinutes, activeMin: row.activeMinutes,
    autoNoMoves: `${row.autoplacedStories}/${row.storyCount}`, manualMoves: row.manualMoves })))
  console.log(`Minutes basis: ${summary.minutes.basis}`)
  console.log('Page size is recorded per issue; eight-page qualification does not certify a printer profile or physical proof.')
  for (const [name, metric] of [['B.minutes.w8', summary.minutes], ['G1.autoplaced', summary.placement]]) {
    console.log(`${name}: ${metric.eligible ? `reviewable median ${metric.median}` : `not eligible — ${metric.reason}`}`)
    if (metric.eligible) {
      const key = name === 'B.minutes.w8' ? 'median' : 'pct'
      // Generated command text only. Operator identity and notes must be reviewed by the user.
      console.log(`Suggested USER command after checking the original records: npm run record -- ${name} ${key}=${metric.median} --by YOUR_NAME --note "Reviewed local last-four production ledger; include issue IDs and timing basis"`)
    }
  }
  console.log('Local eligibility is not gate activation, deadline verification, PDF/X certification or printer acceptance.')
}

main().catch(error => { console.error(error.message); process.exitCode = 1 })
