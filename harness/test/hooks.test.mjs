// Tests of the Claude Code safety hooks in .claude/hooks. If these fail, the guard rails are not guarding.
// Every case runs the hook against its own temp project, so an unlock file in the real repo cannot change the outcome.
import test from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const hook = name => path.join(root, '.claude/hooks', name)
const env = projectDir => { const e = { ...process.env, CLAUDE_PROJECT_DIR: projectDir }; delete e.STUDIO_ALLOW_PROTECTED; return e }
// A temp project holding copies of one real test and one real helper; no .claude/ALLOW_PROTECTED_EDITS.
function fixture() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'studio-hook-'))
  for (const f of ['packages/engine/test/guardrails.test.js', 'packages/engine/test/helpers/invariants.js']) {
    fs.mkdirSync(path.dirname(path.join(tmp, f)), { recursive: true }); fs.copyFileSync(path.join(root, f), path.join(tmp, f))
  }
  return tmp
}
const proj = fixture()
const run = (script, input, projectDir = proj) =>
  spawnSync(process.execPath, [hook(script)], { input: JSON.stringify(input), encoding: 'utf8', env: env(projectDir) })
const pre = (tool_name, tool_input, projectDir = proj) => run('protect-gates.mjs', { hook_event_name: 'PreToolUse', tool_name, tool_input, cwd: projectDir }, projectDir)
const existingTest = 'packages/engine/test/guardrails.test.js'
const blocked = (r, why) => assert.equal(r.status, 2, why)
const allowed = (r, why) => assert.equal(r.status, 0, `${why}\n${r.stderr}`)

test('locked files cannot be edited or written: .claude, runners, judges, lock, ratchet, tools, results', () => {
  for (const f of ['.claude/settings.json', '.claude/hooks/stop-check.mjs', '.claude/ALLOW_PROTECTED_EDITS', 'harness/run.mjs', 'harness/run-tests.mjs',
    'harness/judges.mjs', 'harness/judges.lock.json', 'harness/test-ratchet.json', 'harness/tools/approve-judges.mjs', 'harness/tools/anything-new.mjs', 'harness/results/G2.proof.json'])
    blocked(pre('Write', { file_path: f, content: '{"accepted":1}' }), f)
})
test('absolute and backslash paths are normalised', () => {
  blocked(pre('Edit', { file_path: path.join(proj, 'harness/run.mjs'), old_string: 'a', new_string: 'b' }))
  blocked(pre('Edit', { file_path: 'harness\\run.mjs', old_string: 'a', new_string: 'b' }))
  blocked(pre('Edit', { file_path: 'harness/../harness/run.mjs', old_string: 'a', new_string: 'b' }))
  blocked(pre('Edit', { file_path: path.join(proj, existingTest), old_string: "test('product name", new_string: "test.skip('product name" }), 'absolute test path')
})
test('gates.json and the spike scorer are editable: the judges lock makes the change wait for Amal', () => {
  allowed(pre('Edit', { file_path: 'harness/gates.json', old_string: '"pending"', new_string: '"active"' }))
  allowed(pre('Edit', { file_path: 'spike/run.mjs', old_string: 'a', new_string: 'b' }))
})
test('a new test file may be created', () => allowed(pre('Write', { file_path: 'packages/engine/test/brand-new.test.js', content: 'x' })))
test('an existing test file may be rewritten, unless the rewrite switches tests off', () => {
  allowed(pre('Write', { file_path: existingTest, content: "import test from 'node:test'\ntest('x', () => {})\n" }))
  blocked(pre('Write', { file_path: existingTest, content: "import test from 'node:test'\ntest.only('x', () => {})\n" }), '.only')
})
test('tests may be added to and changed: the judges lock, not the hook, holds approved tests', () => {
  allowed(pre('Edit', { file_path: existingTest, old_string: 'assert.deepEqual(bad, [])', new_string: 'assert.deepEqual(bad, [])\n  assert.ok(1)' }))
  allowed(pre('Edit', { file_path: existingTest, old_string: 'assert.deepEqual(bad, [])', new_string: 'assert.ok(true)' }))
})
test('edits that switch tests off are blocked', () => {
  blocked(pre('Edit', { file_path: existingTest, old_string: "('product name", new_string: ".skip('product name" }), '.skip')
  blocked(pre('Edit', { file_path: existingTest, old_string: "import test from 'node:test'", new_string: "import test from 'node:test'\nprocess.exit(0)" }), 'exit')
  blocked(pre('Edit', { file_path: existingTest, old_string: "test('", new_string: "test.todo('", replace_all: true }), 'replace_all .todo')
  blocked(pre('Edit', { file_path: existingTest, old_string: 'import assert', new_string: 'import assert\nassert.ok = () => {}\n' }), 'rewire assert')
})
test('MultiEdit is blocked if any edit switches a test off', () => {
  const good = { old_string: 'assert.deepEqual(bad, [])', new_string: 'assert.ok(true)' }, bad = { old_string: "test('every", new_string: "test.skip('every" }
  allowed(pre('MultiEdit', { file_path: existingTest, edits: [good] }))
  blocked(pre('MultiEdit', { file_path: existingTest, edits: [good, bad] }))
})
test('test helpers are editable like tests, and cannot switch tests off either', () => {
  allowed(pre('Edit', { file_path: 'packages/engine/test/helpers/invariants.js', old_string: 'a', new_string: 'b' }))
  blocked(pre('Edit', { file_path: 'packages/engine/test/helpers/invariants.js', old_string: 'import assert', new_string: 'process.exit(0)\nimport assert' }))
})
test('ordinary source files are untouched', () => {
  allowed(pre('Edit', { file_path: 'packages/engine/src/flow.js', old_string: 'a', new_string: 'b' }))
  allowed(pre('Write', { file_path: 'apps/web/page.tsx', content: 'x' }))
})
test('human-only levers cannot be pulled from the shell', () => {
  for (const command of ['touch .claude/ALLOW_PROTECTED_EDITS', 'echo > .claude/allow_protected_edits', 'export STUDIO_ALLOW_PROTECTED=1 && claude',
    'npm run approve -- --yes --loosen', 'node harness/tools/approve-judges.mjs --yes', 'npm run record -- G2.proof accepted=1 --by Amal',
    'rm harness/test-ratchet.json', 'git checkout harness/judges.lock.json'])
    blocked(pre('Bash', { command }), command)
})
test('shell commands that change locked files or tests are blocked', () => {
  for (const command of ['sed -i s/a/b/ harness/run.mjs', 'echo x >> harness/run-tests.mjs', 'rm packages/engine/test/invariants.test.js',
    'git checkout -- packages/engine/test/helpers/fuzz.js', 'cp /tmp/x .claude/settings.json', 'cat a > packages/engine/test/helpers/fuzz.js',
    'touch .claude/hooks/x.mjs', 'git apply x.patch packages/engine/test/a.test.js', 'echo 1 > harness/results/G1.time.json', 'cp x harness/tools/new.mjs',
    `node -e "require('fs').writeFileSync('packages/engine/test/guardrails.test.js','')"`, `python3 -c "open('.claude/settings.json','w')"`,
    'sed -E -i "s/x/y/" packages/engine/test/conservation.test.js'])
    blocked(pre('Bash', { command }), command)
})
test('ordinary shell commands are allowed', () => {
  for (const command of ['npm test', 'npm test 2>&1 | tail -40', 'git status', 'node --test packages/engine/test/foo.test.js > out.txt', 'git checkout -b feature/flow',
    'rm spike/out/report.md', 'npm run harness -- --phase 0 --fast', 'node harness/run.mjs --phase 0 2>&1', 'cat harness/gates.json', 'git diff harness packages/engine/test',
    'cd spike && node run.mjs --fonts "Halant,Hind"', 'git add -A && git commit -m "Phase 0 task 5: flow.js"'])
    allowed(pre('Bash', { command }), command)
})
test('the human can allow edits with a fresh .claude/ALLOW_PROTECTED_EDITS, and it expires after an hour', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'studio-allow-'))
  fs.mkdirSync(path.join(tmp, '.claude')); const f = path.join(tmp, '.claude/ALLOW_PROTECTED_EDITS'); fs.writeFileSync(f, '')
  const edit = { tool_name: 'Edit', tool_input: { file_path: 'harness/run.mjs', old_string: 'a', new_string: 'b' }, cwd: tmp }
  allowed(run('protect-gates.mjs', edit, tmp), 'fresh unlock file')
  const old = new Date(Date.now() - 2 * 60 * 60 * 1000); fs.utimesSync(f, old, old)
  blocked(run('protect-gates.mjs', edit, tmp), 'stale unlock file')
})
test('garbage input does not crash the hook or block work', () =>
  assert.equal(spawnSync(process.execPath, [hook('protect-gates.mjs')], { input: 'not json', encoding: 'utf8', env: env(proj) }).status, 0))

function project(exitCode) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'studio-stop-'))
  fs.mkdirSync(path.join(tmp, 'harness'))
  fs.writeFileSync(path.join(tmp, 'harness/run-tests.mjs'), `console.log('FAIL  demo'); process.exit(${exitCode})`)
  return tmp
}
test('stop hook lets Claude finish when tests pass', () => assert.equal(run('stop-check.mjs', { session_id: 'pass-' + Date.now() }, project(0)).status, 0))
test('stop hook blocks twice while tests fail, then lets Claude explain, then starts counting again', () => {
  const dir = project(1), sid = 'fail-' + Date.now()
  assert.equal(run('stop-check.mjs', { session_id: sid }, dir).status, 2)
  const second = run('stop-check.mjs', { session_id: sid }, dir)
  assert.equal(second.status, 2); assert.match(second.stderr, /attempt 2 of 2/)
  assert.equal(run('stop-check.mjs', { session_id: sid }, dir).status, 0)
  assert.equal(run('stop-check.mjs', { session_id: sid }, dir).status, 2, 'a later task in the same session is checked again')
})
test('stop hook does nothing in a project without the harness', () =>
  assert.equal(run('stop-check.mjs', { session_id: 'none' }, fs.mkdtempSync(path.join(os.tmpdir(), 'studio-empty-'))).status, 0))

// The hook no longer reads harness/judges.lock.json: approved tests are held by the lock at `npm test` time.
const APPROVED = "test('approved', () => assert.ok(1))", MINE = "test('mine', () => assert.ok(2))"
function lockedProject(lines, lock = { appendOnly: { 'packages/x/test/a.test.js': [APPROVED] } }) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'studio-lock-'))
  fs.mkdirSync(path.join(tmp, 'harness')); fs.mkdirSync(path.join(tmp, 'packages/x/test'), { recursive: true })
  if (lock) fs.writeFileSync(path.join(tmp, 'harness/judges.lock.json'), JSON.stringify(lock))
  fs.writeFileSync(path.join(tmp, 'packages/x/test/a.test.js'), lines.join('\n') + '\n')
  return (old_string, new_string) => run('protect-gates.mjs', { tool_name: 'Edit', tool_input: { file_path: 'packages/x/test/a.test.js', old_string, new_string }, cwd: tmp }, tmp)
}
test('editing an approved line is allowed by the hook', () => {
  const edit = lockedProject([APPROVED, MINE])
  allowed(edit('assert.ok(1)', 'assert.ok(5)'), 'change an approved line')
  allowed(edit('assert.ok(2)', 'assert.ok(3)'), 'change an unapproved line')
})
test('removing a test is allowed by the hook (the judges lock and the ratchet catch it)', () => {
  const edit = lockedProject([APPROVED, MINE, APPROVED])
  allowed(edit(`${MINE}\n${APPROVED}`, MINE), 'remove a copy of an approved line')
  allowed(edit(`${APPROVED}\n`, ''), 'remove an approved line')
})
test('without a judges lock, edits to tests are checked only for switching tests off', () => {
  const edit = lockedProject([APPROVED, MINE], null)
  allowed(edit('assert.ok(2)', 'assert.ok(3)'), 'change')
  blocked(edit(MINE, `${MINE}\ntest.only('more', () => {})`), '.only')
})
test('an unlock file in another project does not lift blocks in this one', () => {
  const other = fs.mkdtempSync(path.join(os.tmpdir(), 'studio-other-'))
  fs.mkdirSync(path.join(other, '.claude')); fs.writeFileSync(path.join(other, '.claude/ALLOW_PROTECTED_EDITS'), '')
  blocked(pre('Edit', { file_path: 'harness/run.mjs', old_string: 'a', new_string: 'b' }), 'fixture project has no unlock file')
})
test('read-only inline code and reads of tests are allowed', () => {
  for (const command of [`node -e "console.log(require('fs').readFileSync('packages/engine/test/guardrails.test.js','utf8'))"`,
    `node --input-type=module -e "import { installFakeCanvas } from './packages/engine/test/helpers/fake-canvas.js'; installFakeCanvas()"`,
    `node -e "console.log(require('./harness/gates.json').gates.length)"; grep -n flow harness/run.mjs; cat packages/engine/test/guardrails.test.js`,
    'cat packages/engine/test/conservation.test.js', 'sed -n 1,20p packages/engine/test/helpers/invariants.js'])
    allowed(pre('Bash', { command }), command)
})
test('shell appends and inline writes to test files are still blocked', () => {
  for (const command of ["cat >> packages/engine/test/flow.cases.test.js <<'EOF'\ntest('x', () => {})\nEOF", 'echo "test()" >> packages/engine/test/guardrails.test.js',
    `node -e "require('fs').appendFileSync('packages/engine/test/guardrails.test.js','x')"`, `python3 -c "import os; os.remove('packages/engine/test/a.test.js')"`])
    blocked(pre('Bash', { command }), command)
})
