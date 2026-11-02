import fs from 'node:fs/promises'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { appendIssue, validateIssue, validateLedger } from './ledger.js'

export async function readLedger(file) {
  return validateLedger(JSON.parse(await fs.readFile(file, 'utf8')))
}

export async function appendToFile(file, issue) {
  validateIssue(issue)
  await fs.mkdir(path.dirname(file), { recursive: true })
  let lock
  try { lock = await fs.open(file + '.lock', 'wx') }
  catch (error) {
    if (error.code === 'EEXIST') throw new Error('Ledger is locked by another writer; review the lock before retrying')
    throw error
  }
  const temporary = `${file}.${randomUUID()}.tmp`
  try {
    let previous
    try {
      if ((await fs.lstat(file)).isSymbolicLink()) throw new Error('Ledger destination must not be a symbolic link')
      previous = await readLedger(file)
    } catch (error) {
      if (error.code !== 'ENOENT') throw error
      previous = { schemaVersion: 1, kind: issue.kind, issues: [] }
    }
    const next = appendIssue(previous, issue)
    const output = await fs.open(temporary, 'wx')
    try { await output.writeFile(JSON.stringify(next, null, 2) + '\n'); await output.sync() }
    finally { await output.close() }
    await fs.rename(temporary, file)
    return next
  } finally {
    await fs.rm(temporary, { force: true })
    await lock.close()
    await fs.rm(file + '.lock')
  }
}
