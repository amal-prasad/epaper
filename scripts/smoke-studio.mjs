// Smoke check for the Studio app: starts it, opens the sample issue in Chromium, and fails on console errors, no rendered
// lines, or any line wider than the box the engine gave it. Writes a screenshot. Run: node scripts/smoke-studio.mjs [out.png]
import { spawn } from 'node:child_process'
import { chromium } from 'playwright'

const url = 'http://localhost:3210/issue/sample'
const out = process.argv[2] ?? 'demos/studio-editor/page.png'
const app = spawn('npm', ['run', 'dev', '-w', '@studio/app'], { shell: true, stdio: ['ignore', 'pipe', 'pipe'] })
let log = ''
app.stdout.on('data', d => { log += d }); app.stderr.on('data', d => { log += d })
const stop = () => { if (process.platform === 'win32') spawn('taskkill', ['/pid', String(app.pid), '/t', '/f']); else app.kill() }

let failed = false
try {
  for (let i = 0; ; i++) {
    try { if ((await fetch(url)).ok) break } catch {}
    if (i > 120) throw new Error(`app did not start:\n${log}`)
    await new Promise(r => setTimeout(r, 1000))
  }
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1440, height: 1040 } })
  const errors = []
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()) })
  page.on('pageerror', e => errors.push(e.message))
  await page.goto(url)
  await page.waitForSelector('[data-line]', { timeout: 60000 })
  const lines = await page.$$eval('[data-line]', els => els.map(el => {
    const r = document.createRange(); r.selectNodeContents(el)
    return { text: el.textContent, natural: r.getBoundingClientRect().width, box: el.getBoundingClientRect().width, hasBox: !!el.style.width }
  }))
  const wide = lines.filter(l => l.hasBox && l.natural > l.box + 0.5)
  await page.screenshot({ path: out, fullPage: true })
  await browser.close()
  console.log(`lines drawn: ${lines.length}; wider than box: ${wide.length}; console errors: ${errors.length}`)
  for (const e of errors) console.log('  error:', e)
  for (const w of wide.slice(0, 5)) console.log('  wide:', w.text)
  failed = !lines.length || wide.length > 0 || errors.length > 0
} catch (e) { console.error(e.message); failed = true } finally { stop() }
console.log(failed ? 'SMOKE FAIL' : 'SMOKE PASS')
process.exitCode = failed ? 1 : 0
