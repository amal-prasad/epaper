// protect-gates.mjs on test files (D-024): editable whatever the judges lock says, but never switched off; Windows paths;
// MultiEdit. HOOK=<path> runs them against another copy of the hook (default: the installed one).
import test from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const hook = process.env.HOOK ? path.resolve(process.env.HOOK) : path.join(root, '.claude/hooks/protect-gates.mjs')
const blocked = (r, why) => assert.equal(r.status, 2, `${why}\n${r.stderr}`)
const allowed = (r, why) => assert.equal(r.status, 0, `${why}\n${r.stderr}`)

const FILE = 'packages/x/test/a.test.js'
const APPROVED = "test('approved', () => assert.ok(1))", MINE = "test('mine', () => assert.ok(2))"
// A throwaway project with one test file; `lock` is written verbatim (string), as JSON (object), or not at all (null).
function project(lock) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'studio-extra-'))
  fs.mkdirSync(path.join(tmp, 'harness')); fs.mkdirSync(path.join(tmp, 'packages/x/test'), { recursive: true })
  if (lock !== null) fs.writeFileSync(path.join(tmp, 'harness/judges.lock.json'), typeof lock === 'string' ? lock : JSON.stringify(lock))
  fs.writeFileSync(path.join(tmp, FILE), [APPROVED, MINE].join('\n') + '\n')
  const env = { ...process.env, CLAUDE_PROJECT_DIR: tmp }; delete env.STUDIO_ALLOW_PROTECTED
  return (tool_name, tool_input) => spawnSync(process.execPath, [hook], { input: JSON.stringify({ tool_name, tool_input, cwd: tmp }), encoding: 'utf8', env })
}
const LOCK = { appendOnly: { [FILE]: [APPROVED] } }

for (const [name, lock] of [['missing', null], ['invalid JSON', '{ "appendOnly": ']]) {
  test(`judges lock ${name}: tests are still editable, and switching one off is still blocked`, () => {
    const pre = project(lock)
    allowed(pre('Edit', { file_path: FILE, old_string: 'assert.ok(2)', new_string: 'assert.ok(3)' }), 'change')
    allowed(pre('Edit', { file_path: FILE, old_string: MINE, new_string: `${MINE}\ntest('more', () => {})` }), 'additive')
    blocked(pre('MultiEdit', { file_path: FILE, edits: [{ old_string: MINE, new_string: `${MINE}\ntest.skip('x', () => {})` }] }), 'MultiEdit .skip')
  })
}

test('Windows: a backslash path with different casing is still treated as a test', { skip: process.platform !== 'win32' && 'Windows only' }, () => {
  const pre = project(LOCK)
  blocked(pre('Edit', { file_path: 'Packages\\X\\Test\\A.test.js', old_string: "test('approved'", new_string: "test.only('approved'" }), 'relative')
  blocked(pre('Edit', { file_path: 'PACKAGES\\x\\TEST\\a.TEST.JS', old_string: "test('approved'", new_string: "test.only('approved'" }), 'upper case')
  allowed(pre('Edit', { file_path: 'Packages\\X\\Test\\A.test.js', old_string: 'assert.ok(1)', new_string: 'assert.ok(5)' }), 'plain change')
})

test('MultiEdit whose second edit switches a test off is blocked', () => {
  const pre = project(LOCK)
  blocked(pre('MultiEdit', { file_path: FILE, edits: [{ old_string: 'assert.ok(2)', new_string: 'assert.ok(3)' }, { old_string: "test('approved'", new_string: "test.skip('approved'" }] }), 'second edit')
})
