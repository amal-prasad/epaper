// Smoke check for the Studio app: starts it, opens the sample issue in Chromium, and fails on console errors, no rendered
// lines, or any line wider than the box the engine gave it. Writes a screenshot. Run: node scripts/smoke-studio.mjs [out.png]
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { chromium } from 'playwright'

const require = createRequire(import.meta.url)

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
  // UX_SPEC §3 rules the lint checks, run here until the editor route is in harness/ux/routes.json.
  const primaries = await page.locator('[data-ux="primary"]:visible').count()
  const marks = await page.locator('[data-mark]').count()
  const percent = (await page.locator('body').innerText()).match(/\d+\s*%/g) ?? []
  await page.addScriptTag({ path: require.resolve('axe-core/axe.min.js') })
  const axe = await page.evaluate(async () => (await window.axe.run(document, { resultTypes: ['violations'] })).violations
    .filter(v => ['serious', 'critical'].includes(v.impact)).map(v => `${v.id}: ${v.nodes.length}`))
  // The check queue: the primary button selects the first problem and announces it.
  let queue = 'no problems'
  if (await page.locator('[data-ux="primary"]', { hasText: 'जाँच' }).count()) {
    await page.click('[data-ux="primary"]')
    const pressed = await page.locator('main [aria-pressed="true"]').count()
    const said = await page.locator('[aria-live="polite"]').first().innerText()
    queue = pressed === 1 && said ? `ok: ${said}` : `FAILED (pressed ${pressed}, said "${said}")`
  }
  await page.screenshot({ path: out, fullPage: true })
  // Undo path: empty the selected slot (an engine op), then Ctrl Z restores it and redo empties it again.
  let undoCheck = 'skipped (nothing selected)'
  const slot = page.locator('main button[aria-pressed="true"]')
  if (await slot.count() === 1 && await page.locator('button', { hasText: 'स्लॉट खाली करें' }).count()) {
    const before = await slot.getAttribute('aria-label')
    await page.click('button:has-text("स्लॉट खाली करें")')
    const emptied = await slot.getAttribute('aria-label'), toast = await page.locator('[role="status"]').innerText().catch(() => '')
    await page.screenshot({ path: out.replace(/\.png$/, '-toast.png'), fullPage: true })
    await page.keyboard.press('Control+z')
    const restored = await slot.getAttribute('aria-label')
    await page.click('button:has-text("फिर से")')
    const redone = await slot.getAttribute('aria-label')
    const ok = emptied.endsWith('खाली जगह') && toast.includes('खबर हटाई गई') && restored === before && redone === emptied
    undoCheck = ok ? 'ok: emptied, toast, Ctrl Z restored, redo emptied' : `FAILED (${JSON.stringify({ before, emptied, toast, restored, redone })})`
  }
  console.log(`undo/redo: ${undoCheck}`)
  if (undoCheck.startsWith('FAILED')) failed = true
  await browser.close()
  console.log(`lines drawn: ${lines.length}; wider than box: ${wide.length}; console errors: ${errors.length}`)
  console.log(`primary buttons: ${primaries}; marks: ${marks}; percent text: ${percent.length}; axe serious/critical: ${axe.length}; check queue: ${queue}`)
  for (const e of errors) console.log('  error:', e)
  for (const w of wide.slice(0, 5)) console.log('  wide:', w.text)
  for (const a of axe) console.log('  axe:', a)
  failed = failed || !lines.length || wide.length > 0 || errors.length > 0 || primaries !== 1 || percent.length > 0 || axe.length > 0 || queue.startsWith('FAILED')
} catch (e) { console.error(e.message); failed = true } finally { stop() }
console.log(failed ? 'SMOKE FAIL' : 'SMOKE PASS')
process.exitCode = failed ? 1 : 0
