// PreToolUse hook: stops Claude from weakening the things that judge its work. This is the first line of defence;
// the second is harness/judges.mjs, which fails `npm test` and the harness on ANY unapproved change, however it was made.
//
//  locked     no edits by Claude at all: .claude/, the harness runners, the judges lock and ratchet, the approve and
//             record tools, and harness/results/ (results are written by scripts or by Amal with `npm run record`)
//  appendOnly existing tests and test helpers: new files are fine; an Edit may change or remove only lines that are not
//             approved in harness/judges.lock.json (matched by trimmed content). Approved lines are never changed.
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
const SABOTAGE = /process\.(exit|kill|abort)|\.only\s*\(|\bonly\s*:\s*true|\.skip\s*\(|\.todo\s*\(|\bskip\s*:\s*true|\b(assert|strict)\s*\.\s*\w+\s*=[^=]/
const count = (re, s) => (String(s).match(new RegExp(re.source, 'g')) || []).length
const introduces = (o, n) => count(SABOTAGE, n) > count(SABOTAGE, o)
// Convenience filter, not a security boundary: it only spares read-only commands from false blocks and is easy to evade.
// The real guard is the judges lock (harness/judges.mjs), which fails `npm test` on any unapproved change however it was made.
// Inline code that can write or spawn: only then does a protected path in a `node -e` / `python -c` command block it.
const WRITES = /\b(write\w*|append\w*|unlink\w*|rm\w*|rename\w*|copy\w*|cp\w*|truncate\w*|createWriteStream|symlink\w*|link\w*|chmod\w*|utimes\w*|exec\w*|spawn\w*|fork|system|remove|put_contents|move)\s*\(|\bopen\s*\([^)]*['"]\+?[wax>+]|\bos\.(remove|unlink|rename|replace|rmdir|removedirs|system|truncate)|\b(shutil|subprocess)\.|\bFile\.(write|delete|rename)/

// Lines of a file approved in the judges lock, trimmed; null when the lock is missing or unreadable.
function approvedLines(r) {
  let lock
  try { lock = JSON.parse(fs.readFileSync(path.join(root, 'harness/judges.lock.json'), 'utf8')) } catch { return null }
  const entry = Object.entries(lock.appendOnly || {}).find(([k]) => (WIN ? k.toLowerCase() : k) === r)
  return new Set((entry ? entry[1] : []).map(l => l.trim()).filter(Boolean))
}
// Trimmed non-blank lines in `before` that are missing from `after`, counted as a multiset.
function removedLines(before, after) {
  const left = new Map()
  for (const l of after.split('\n')) { const t = l.trim(); if (t) left.set(t, (left.get(t) || 0) + 1) }
  const out = []
  for (const l of before.split('\n')) { const t = l.trim(); if (!t) continue; if (left.get(t)) left.set(t, left.get(t) - 1); else out.push(t) }
  return out
}
// The file text after the edits, or null if an old_string is not found (then the edit is blocked).
function applyEdits(text, edits) {
  const lf = s => String(s ?? '').replace(/\r\n?/g, '\n')
  let t = lf(text)
  for (const e of edits) {
    const o = lf(e.old_string), n = lf(e.new_string), i = t.indexOf(o)
    if (!o || i < 0) return null
    t = t.slice(0, i) + n + t.slice(i + o.length)
  }
  return t
}

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
  // inline code that only reads (console.log, readFileSync, import) is fine; inline code that can write is not
  if (redirect.test(c) || mutator.test(c) || (inline.test(c) && WRITES.test(cmd))) block('this shell command changes a protected file (.claude, harness runners, results, or a test).')
  process.exit(0)
}

const file = ti.file_path || ti.notebook_path
if (!file) process.exit(0)
const r = rel(file)
if (r.startsWith('../')) process.exit(0)                         // outside the project
if (LOCKED(r)) block(`${r} is locked (Claude config, harness runners, judges lock, or results). Only Amal changes it.`)
if (APPEND_ONLY(r)) {
  const abs = path.resolve(root, gitBash(slash(file)))
  const exists = fs.existsSync(abs)
  if (tool === 'Write') { if (exists) block(`${r} is an existing test or test helper; do not rewrite it. Add new tests with Edit, or ask.`); process.exit(0) }
  const edits = tool === 'MultiEdit' ? (ti.edits || []) : tool === 'Edit' ? [ti] : null
  if (tool === 'NotebookEdit') block(`${r}: notebook edits of tests are not allowed.`)
  if (edits && edits.some(e => e.replace_all)) block(`replace_all is not allowed on tests (${r}).`)
  if (edits && edits.some(e => introduces(e.old_string, e.new_string))) block(`this edit adds skip/only/todo/exit or rewires assert in ${r}.`)
  if (edits && exists) {
    // Fail closed: with no readable lock, or an old_string not found as given, the hook cannot check the edit, so it blocks it.
    const approved = approvedLines(r)
    if (!approved) block(`harness/judges.lock.json is missing or not valid JSON, so edits to ${r} cannot be checked. Amal: run \`npm run approve\`.`)
    const before = fs.readFileSync(abs, 'utf8'), after = applyEdits(before, edits)
    if (after === null) block(`an old_string was not found in ${r} as given, so the edit cannot be checked against the judges lock.`)
    else {
      const hit = removedLines(before.replace(/\r\n?/g, '\n'), after).filter(l => approved.has(l))
      if (hit.length) block(`this edit changes or removes approved lines in ${r}:\n  ${hit.join('\n  ')}\nApproved tests may only be added to, not weakened. If the test is wrong, show Amal why.`)
    }
  }
}
process.exit(0)
