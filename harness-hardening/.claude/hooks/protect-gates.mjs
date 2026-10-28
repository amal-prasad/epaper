// PreToolUse hook: stops Claude from weakening the things that judge its work. This is the first line of defence;
// the second is harness/judges.mjs, which fails `npm test` and the harness on ANY unapproved change, however it was made.
//
//  locked     no edits by Claude at all: .claude/, the harness runners, the judges lock and ratchet, the approve and
//             record tools, and harness/results/ (results are written by scripts or by Amal with `npm run record`)
//  appendOnly existing tests and test helpers: new files and purely additive edits are fine; changing lines is blocked
//  everything else (gates.json, spike scorer, CLAUDE.md...) may be edited, but harness/judges.mjs makes the change
//             count for nothing until Amal approves it with `npm run approve`
//
// Amal can lift the block for 60 minutes by creating the empty file .claude/ALLOW_PROTECTED_EDITS (delete it afterwards),
// or for one session by starting Claude Code with STUDIO_ALLOW_PROTECTED=1 in the environment.
// The Bash checks are heuristics, not a wall: the judges lock is what catches what they miss.
import fs from 'node:fs'
import path from 'node:path'

let input = {}
try { input = JSON.parse(fs.readFileSync(0, 'utf8') || '{}') } catch { process.exit(0) }
const root = process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd()
const WIN = process.platform === 'win32'

const unlock = path.join(root, '.claude', 'ALLOW_PROTECTED_EDITS')
if (process.env.STUDIO_ALLOW_PROTECTED === '1') process.exit(0)
try { if (Date.now() - fs.statSync(unlock).mtimeMs < 60 * 60 * 1000) process.exit(0) } catch {}

const block = why => {
  process.stderr.write(`Blocked by project rule 12: ${why}\nDo not work around this (no other tool, script or shell trick). Tell Amal what you wanted to change and why, and wait.\n`)
  process.exit(2)
}

// Normalise any path Claude might send: backslashes, Git Bash drive paths (/d/epaper/...), Windows case-insensitivity.
const slash = p => String(p).replace(/\\/g, '/')
const gitBash = p => WIN ? p.replace(/^\/([a-zA-Z])\//, (_, d) => `${d}:/`) : p
const real = p => { try { return fs.realpathSync.native(p) } catch { try { return path.join(fs.realpathSync.native(path.dirname(p)), path.basename(p)) } catch { return p } } }
const rootReal = slash(real(root))
const rel = f => {
  const abs = slash(real(path.resolve(root, gitBash(slash(f)))))
  let r = slash(path.relative(rootReal, abs))
  return WIN ? r.toLowerCase() : r
}

const LOCKED = r => r.startsWith('.claude/') || r.startsWith('harness/results/') ||
  ['harness/run.mjs', 'harness/run-tests.mjs', 'harness/judges.mjs', 'harness/judges.lock.json', 'harness/test-ratchet.json',
   'harness/tools/approve-judges.mjs', 'harness/tools/record-result.mjs'].includes(r)
const APPEND_ONLY = r => /(^|\/)test\//.test(r) || /\.test\.[cm]?[jt]sx?$/.test(r)
const additive = (o, n) => typeof o === 'string' && typeof n === 'string' && o.length > 0 && n.includes(o)
const SABOTAGE = /process\.(exit|kill|abort)|\.only\s*\(|\bonly\s*:\s*true|\.skip\s*\(|\.todo\s*\(|\bskip\s*:\s*true|\b(assert|strict)\s*\.\s*\w+\s*=[^=]/
const count = (re, s) => (String(s).match(new RegExp(re.source, 'g')) || []).length
const introduces = (o, n) => count(SABOTAGE, n) > count(SABOTAGE, o)

const tool = input.tool_name, ti = input.tool_input || {}

if (tool === 'Bash') {
  const cmd = slash(String(ti.command || ''))
  const c = WIN ? cmd.toLowerCase() : cmd
  // 1. human-only levers, however they are spelled
  if (/allow_protected|studio_allow_protected|approve-judges|record-result|judges\.lock|test-ratchet|npm\s+run\s+(approve|record)\b/i.test(cmd))
    block('that command touches a human-only lever (unlock file, approve, record, judges lock, ratchet).')
  // 2. writes into locked or test paths
  const P = '(\\.claude/|harness/results/|harness/run(-tests)?\\.mjs|harness/judges\\.mjs|[\\w./-]*\\.test\\.[cm]?[jt]sx?|/test/|test/helpers/)'
  const redirect = new RegExp(`(^|[^0-9&])>[>|]?\\s*["']?[^\\s;|&"']*${P}`)
  const mutator = new RegExp(`\\b(sed\\s+(-[A-Za-z]*\\s+)*(-[A-Za-z]*i|--in-place)|perl\\s+-[A-Za-z]*i|tee|rm|rmdir|mv|cp|rsync|truncate|touch|ln|install|dd|chmod|chown|unlink|git\\s+(checkout|restore|reset|stash|clean|rm|mv|apply|am)|patch)\\b[^\\n;|&]*${P}`)
  const inline = new RegExp(`\\b(node|deno|bun|python3?|perl|ruby|php)\\b[^\\n;|&]*\\s(-e|--eval|-p|--print|-c)\\b[\\s\\S]*${P}`)
  if (redirect.test(c) || mutator.test(c) || inline.test(c)) block('this shell command changes a protected file (.claude, harness runners, results, or a test).')
  process.exit(0)
}

const file = ti.file_path || ti.notebook_path
if (!file) process.exit(0)
const r = rel(file)
if (r.startsWith('../')) process.exit(0)                         // outside the project
if (LOCKED(r)) block(`${r} is locked (Claude config, harness runners, judges lock, or results). Only Amal changes it.`)
if (APPEND_ONLY(r)) {
  const exists = fs.existsSync(path.resolve(root, gitBash(slash(file))))
  if (tool === 'Write') { if (exists) block(`${r} is an existing test or test helper; do not rewrite it. Add new tests with Edit (additive), or ask.`); process.exit(0) }
  const edits = tool === 'MultiEdit' ? (ti.edits || []) : tool === 'Edit' ? [ti] : null
  if (tool === 'NotebookEdit') block(`${r}: notebook edits of tests are not allowed.`)
  if (edits && !edits.every(e => additive(e.old_string, e.new_string))) block(`this edit changes existing lines in ${r}. Tests may only be added to, not weakened. If the test is wrong, show Amal why.`)
  if (edits && edits.some(e => introduces(e.old_string, e.new_string))) block(`this edit adds skip/only/todo/exit or rewires assert in ${r}.`)
  if (edits && edits.some(e => e.replace_all)) block(`replace_all is not allowed on tests (${r}).`)
}
process.exit(0)
