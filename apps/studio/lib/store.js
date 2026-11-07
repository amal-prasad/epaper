// Local store (PLAN_REVIEW: local first; Supabase comes with self-serve auth). Server-only.
// Issues live in <repo>/data/issues/<id>.json, or STUDIO_DATA/issues when set.
import fs from 'node:fs/promises'
import path from 'node:path'

export const repoRoot = path.resolve(process.cwd(), '../..')
const dataDir = () => process.env.STUDIO_DATA ?? path.join(repoRoot, 'data')

export async function readIssue(id) {
  if (!/^[\w-]{1,64}$/.test(id)) return null // ids come from the URL: no paths
  try { return JSON.parse(await fs.readFile(path.join(dataDir(), 'issues', `${id}.json`), 'utf8')) }
  catch (e) { if (e.code === 'ENOENT') return null; throw e }
}

export const readInks = async () => JSON.parse(await fs.readFile(path.join(repoRoot, 'fonts/ink.json'), 'utf8'))
