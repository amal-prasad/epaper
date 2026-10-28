// Stop hook: Claude cannot finish while the unit tests are failing. It gets two chances, then is let go so it can
// explain the failure instead of looping forever; the count then resets, so the next task is checked again.
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

let input = {}
try { input = JSON.parse(fs.readFileSync(0, 'utf8') || '{}') } catch {}
const root = process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd()
if (!fs.existsSync(path.join(root, 'harness', 'run-tests.mjs'))) process.exit(0)

const counter = path.join(os.tmpdir(), `studio-stop-${String(input.session_id || 'x').replace(/[^\w-]/g, '')}`)
const r = spawnSync(process.execPath, ['harness/run-tests.mjs'], { cwd: root, encoding: 'utf8', timeout: 280_000, maxBuffer: 32 << 20 })
if (r.status === 0) { try { fs.rmSync(counter) } catch {} ; process.exit(0) }

let n = 0; try { n = Number(fs.readFileSync(counter, 'utf8')) || 0 } catch {}
if (n >= 2) { try { fs.rmSync(counter) } catch {} ; process.exit(0) }
fs.writeFileSync(counter, String(n + 1))

const out = (r.stdout || '') + (r.stderr || '')
const timedOut = r.error?.code === 'ETIMEDOUT' || r.signal
const judges = /Judge files changed without Amal's approval/.test(out)
const tail = out.split('\n').filter(l => /^(FAIL|\s+not ok|\s+error:|\s+-\s|.*expected|.*actual|\d+ passed)/.test(l)).slice(0, 30).join('\n')
const msg = timedOut ? 'The unit tests did not finish within 280 s (hang or infinite loop?).'
  : judges ? 'You changed a judge (gates, a test, the spike scorer, npm scripts or CLAUDE.md rules). Only Amal can approve that.\nStop and tell Amal exactly what you changed in which file and why, so he can read the diff and run `npm run approve`. Do not try to undo the check.'
  : 'Unit tests are failing, so the work is not done.'
process.stderr.write(`${msg} (attempt ${n + 1} of 2)\n${tail}\nFix the code, not the tests (rule 12). If you cannot, tell Amal exactly which test fails and why.\n`)
process.exit(2)
