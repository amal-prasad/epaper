import test from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../../../', import.meta.url))
const run = args => spawnSync(process.execPath, ['scripts/production-log.mjs', ...args], { cwd: root, encoding: 'utf8' })

test('CLI refuses protected output paths and path traversal before any write', () => {
  for (const target of ['harness/results/forbidden.json', '.local/production/../../harness/results/forbidden.json', '.local/production/no-extension']) {
    const result = run(['append', 'does-not-exist.json', '--ledger', target])
    assert.equal(result.status, 1)
    assert.match(result.stderr, /inside .local\/production/)
  }
})

test('CLI rejects unknown arguments and provides a read-only help command', () => {
  assert.equal(run(['--help']).status, 0)
  assert.match(run(['summary', '--force']).stderr, /Unknown/)
  assert.match(run(['summary', '--ledger']).stderr, /incomplete/)
})
