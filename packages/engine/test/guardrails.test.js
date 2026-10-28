import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { PRODUCT_NAME } from '../src/config.js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name === 'dist' || e.name === '.next') continue
    const p = path.join(dir, e.name)
    e.isDirectory() ? walk(p, out) : /\.(js|mjs|ts|tsx|json|css)$/.test(e.name) && out.push(p)
  }
  return out
}

test('product name is not a trademarked newspaper name', () => {
  assert.ok(!/patrika|पत्रिका/i.test(PRODUCT_NAME))
})

test('no source file ships the placeholder-forbidden name', () => {
  const bad = ['packages', 'apps', 'services'].flatMap(d => walk(path.join(root, d)))
    .filter(f => !f.endsWith('guardrails.test.js'))
    .filter(f => /patrika/i.test(fs.readFileSync(f, 'utf8')))
  assert.deepEqual(bad, [])
})

test('every stock asset has a licence file', () => {
  const dir = path.join(root, 'apps/web/public/assets/stock')
  if (!fs.existsSync(dir)) return                                   // nothing shipped yet
  const files = fs.readdirSync(dir).filter(f => !f.endsWith('.licence.txt'))
  const missing = files.filter(f => !fs.existsSync(path.join(dir, f + '.licence.txt')))
  assert.deepEqual(missing, [])
})
