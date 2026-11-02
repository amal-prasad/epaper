import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { appendToFile, readLedger } from '../src/store.js'

const issue = id => ({ id, kind: 'real', publication: 'Pilot', operator: 'Amal', measurementNote: 'Notebook',
  producedAt: '2026-11-02T12:00:00+05:30', copyReceivedAt: '2026-11-02T10:00:00+05:30', pressSentAt: '2026-11-02T12:00:00+05:30',
  paid: false, pageCount: 8, pageSize: { widthMm: 297, heightMm: 420, basis: 'Assumed preset' },
  steps: [{ name: 'Layout', minutes: 90 }], storyCount: 1, stories: [{ id: 's1', initialPlacement: 'auto', manualMoves: 0 }] })

test('atomic local appends preserve previous records and reject duplicates without altering bytes', async t => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'production-ledger-'))
  t.after(() => fs.rm(dir, { recursive: true, force: true }))
  const file = path.join(dir, 'issues.json')
  await appendToFile(file, issue('one'))
  await appendToFile(file, issue('two'))
  assert.deepEqual((await readLedger(file)).issues.map(row => row.id), ['one', 'two'])
  const before = await fs.readFile(file, 'utf8')
  await assert.rejects(appendToFile(file, issue('one')), /Duplicate/)
  assert.equal(await fs.readFile(file, 'utf8'), before)
  assert.deepEqual(await fs.readdir(dir), ['issues.json'])
})

test('corrupt ledgers and busy locks fail closed, retaining original files', async t => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'production-ledger-'))
  t.after(() => fs.rm(dir, { recursive: true, force: true }))
  const file = path.join(dir, 'issues.json')
  await fs.writeFile(file, 'broken json')
  await assert.rejects(appendToFile(file, issue('one')), /JSON/)
  assert.equal(await fs.readFile(file, 'utf8'), 'broken json')
  await fs.writeFile(file + '.lock', 'another writer')
  await assert.rejects(appendToFile(file, issue('one')), /locked/)
  assert.equal(await fs.readFile(file + '.lock', 'utf8'), 'another writer')
})

test('refuses symlink ledger destinations', async t => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'production-ledger-'))
  t.after(() => fs.rm(dir, { recursive: true, force: true }))
  const source = path.join(dir, 'source.json'), link = path.join(dir, 'link.json')
  await appendToFile(source, issue('one'))
  try { await fs.symlink(source, link) } catch (error) {
    // Windows installations can prohibit file symlinks; the lock and corruption tests still exercise file preservation.
    if (error.code === 'EPERM') return
    throw error
  }
  await assert.rejects(appendToFile(link, issue('two')), /symbolic link/)
  assert.equal((await readLedger(source)).issues.length, 1)
})
