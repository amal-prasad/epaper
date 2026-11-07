// Serves the bundled fonts from spike/public, the same files the engine measures and export embeds (rule 3).
import fs from 'node:fs/promises'
import path from 'node:path'
import { repoRoot } from '../../../lib/store.js'

const base = path.join(repoRoot, 'spike/public')
const types = { '.css': 'text/css; charset=utf-8', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf' }

export async function GET(_request, { params }) {
  const file = path.resolve(base, ...(await params).path)
  const type = types[path.extname(file).toLowerCase()]
  if (!file.startsWith(base + path.sep) || !type) return new Response('not found', { status: 404 })
  try {
    return new Response(await fs.readFile(file), { headers: { 'content-type': type, 'cache-control': 'public, max-age=3600' } })
  } catch { return new Response('not found', { status: 404 }) }
}
