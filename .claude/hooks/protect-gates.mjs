// PreToolUse hook: stops Claude from weakening the things that judge its work. This is the first line of defence;
// the second is harness/judges.mjs, which fails `npm test` and the harness on ANY unapproved change, however it was made.
//
//  locked     no edits by Claude at all: .claude/, the harness runners, harness/judges.mjs, the judges lock and ratchet,
//             harness/tools/, and harness/results/ (results are written by scripts or by Amal with `npm run record`)
//  tests      tests and test helpers may be created, edited and rewritten with Edit/Write; the hook blocks only an edit
//             that adds skip/only/todo/exit or rewires assert. Shell writes to tests stay blocked: the hook cannot check them.
//             Any change to an approved test still turns `npm test` red until Amal approves it (harness/judges.mjs).
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

const LOCKED = r => r.startsWith('.claude/') || r.startsWith('harness/results/') || r.startsWith('harness/tools/') ||
  ['harness/run.mjs', 'harness/run-tests.mjs', 'harness/judges.mjs', 'harness/judges.lock.json', 'harness/test-ratchet.json'].includes(r)
const TEST = r => /(^|\/)test\//.test(r) || /\.test\.[cm]?[jt]sx?$/.test(r)
const SABOTAGE = /process\.(exit|kill|abort)|\.only\s*\(|\bonly\s*:\s*true|\.skip\s*\(|\.todo\s*\(|\bskip\s*:\s*true|\b(assert|strict)\s*\.\s*\w+\s*=[^=]/
const count = (re, s) => (String(s ?? '').match(new RegExp(re.source, 'g')) || []).length
const introduces = (o, n) => count(SABOTAGE, n) > count(SABOTAGE, o)
// Convenience filter, not a security boundary: it only spares read-only commands from false blocks and is easy to evade.
// The real guard is the judges lock (harness/judges.mjs), which fails `npm test` on any unapproved change however it was made.
// Inline code that can write or spawn: only then does a protected path in a `node -e` / `python -c` command block it.
const WRITES = /\b(write\w*|append\w*|unlink\w*|rm\w*|rename\w*|copy\w*|cp\w*|truncate\w*|createWriteStream|symlink\w*|link\w*|chmod\w*|utimes\w*|exec\w*|spawn\w*|fork|system|remove|put_contents|move)\s*\(|\bopen\s*\([^)]*['"]\+?[wax>+]|\bos\.(remove|unlink|rename|replace|rmdir|removedirs|system|truncate)|\b(shutil|subprocess)\.|\bFile\.(write|delete|rename)/

const tool = input.tool_name, ti = input.tool_input || {}

if (tool === 'Bash') {
  const cmd = slash(String(ti.command || ''))
  const c = WIN ? cmd.toLowerCase() : cmd
  // 1. human-only levers, however they are spelled
  if (/allow_protected|studio_allow_protected|approve-judges|record-result|judges\.lock|test-ratchet|npm\s+run\s+(approve|record)\b/i.test(cmd))
    block('that command touches a human-only lever (unlock file, approve, record, judges lock, ratchet).')
  // 2. writes into locked or test paths (tests are edited with Edit/Write, where the hook can check for skip/only/exit)
  const P = '(\\.claude/|harness/results/|harness/tools/|harness/run(-tests)?\\.mjs|harness/judges\\.mjs|[\\w./-]*\\.test\\.[cm]?[jt]sx?|/test/|test/helpers/)'
  const redirect = new RegExp(`(^|[^0-9&])>[>|]?\\s*["']?[^\\s;|&"']*${P}`)
  const mutator = new RegExp(`\\b(sed\\s+(-[A-Za-z]*\\s+)*(-[A-Za-z]*i|--in-place)|perl\\s+-[A-Za-z]*i|tee|rm|rmdir|mv|cp|rsync|truncate|touch|ln|install|dd|chmod|chown|unlink|git\\s+(checkout|restore|reset|stash|clean|rm|mv|apply|am)|patch)\\b[^\\n;|&]*${P}`)
  const inline = new RegExp(`\\b(node|deno|bun|python3?|perl|ruby|php)\\b[^\\n;|&]*\\s(-e|--eval|-p|--print|-c)\\b[\\s\\S]*${P}`)
  // inline code that only reads (console.log, readFileSync, import) is fine; inline code that can write is not
  if (redirect.test(c) || mutator.test(c) || (inline.test(c) && WRITES.test(cmd))) block('this shell command changes a protected file (.claude, harness runners or tools, results, or a test). Edit tests with Edit or Write.')
  process.exit(0)
}

const file = ti.file_path || ti.notebook_path
if (!file) process.exit(0)
const r = rel(file)
if (r.startsWith('../')) process.exit(0)                         // outside the project
if (LOCKED(r)) block(`${r} is locked (Claude config, harness runners or tools, judges lock, or results). Only Amal changes it.`)
if (TEST(r)) {
  // Tests are editable; the judges lock holds approved tests until Amal approves. Only switching tests off is blocked here.
  let current = ''
  try { current = fs.readFileSync(path.resolve(root, gitBash(slash(file))), 'utf8') } catch {}
  const pairs = tool === 'Write' ? [[current, ti.content]]
    : tool === 'Edit' ? [[ti.old_string, ti.new_string]]
    : tool === 'MultiEdit' ? (ti.edits || []).map(e => [e.old_string, e.new_string])
    : tool === 'NotebookEdit' ? [['', ti.new_source]] : []
  if (pairs.some(([o, n]) => introduces(o, n))) block(`this edit adds skip/only/todo/exit or rewires assert in ${r}.`)
}
process.exit(0)
