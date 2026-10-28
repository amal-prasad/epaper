// UX lint: enforces the machine-checkable rules from docs/UX_SPEC.md §3 plus axe-core.
// Usage: node harness/ux/ux-lint.mjs [--base http://localhost:3000]
// Writes harness/results/G1.a11y.json {serious} and harness/results/G1.ux.json {violations}; exits 1 on any violation.
// Mark your UI: [data-ux="primary"] (one per screen), [data-ux="toolbar"], [data-ux="help"] (consistent help link).
import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const { chromium } = require('playwright')
const axeSource = fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8')
const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '../..')
const cfg = JSON.parse(fs.readFileSync(path.join(here, 'routes.json'), 'utf8'))
const baseArg = process.argv.includes('--base') ? process.argv[process.argv.indexOf('--base') + 1] : null

let server, base = baseArg || cfg.baseUrl
if (base === 'fixture') {
  const dir = path.join(here, 'fixture')
  server = http.createServer((q, s) => {
    const f = path.join(dir, q.url.split('?')[0] === '/' ? 'index.html' : q.url.split('?')[0])
    if (!f.startsWith(dir) || !fs.existsSync(f)) return s.writeHead(404).end()
    s.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }).end(fs.readFileSync(f))
  }).listen(0)
  base = `http://localhost:${server.address().port}`
}

const violations = []
let serious = 0
const add = (route, vp, rule, detail) => violations.push({ route, viewport: vp, rule, detail })

const browser = await chromium.launch()
for (const r of cfg.routes) for (const vpName of r.viewports) {
  const vp = cfg.viewports[vpName]
  const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } })
  await page.goto(base + r.path, { waitUntil: 'networkidle' })

  // --- axe
  await page.addScriptTag({ content: axeSource })
  const axe = await page.evaluate(() => axe.run(document, { resultTypes: ['violations'] }))
  for (const v of axe.violations) {
    if (v.impact === 'serious' || v.impact === 'critical') { serious++; add(r.name, vpName, `axe:${v.id}`, `${v.impact}: ${v.help} (${v.nodes.length} nodes)`) }
  }

  // --- structural rules from UX_SPEC §3
  const res = await page.evaluate(({ minTarget, minBodyPx }) => {
    const out = []
    const vis = el => { const b = el.getBoundingClientRect(); const s = getComputedStyle(el)
      return b.width > 0 && b.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' }
    const primaries = [...document.querySelectorAll('[data-ux="primary"]')].filter(vis)
    if (primaries.length !== 1) out.push(['one-primary', `found ${primaries.length} visible primary buttons, need exactly 1`])
    for (const tb of [...document.querySelectorAll('[data-ux="toolbar"]')].filter(vis)) {
      const n = [...tb.querySelectorAll('button, [role="button"], a')].filter(vis).length
      if (n > 5) out.push(['toolbar-size', `toolbar has ${n} buttons, max 5 (put the rest under "और")`])
    }
    if ([...document.querySelectorAll('[role="dialog"], dialog[open]')].filter(vis).length > 1) out.push(['one-modal', 'more than one modal open'])
    if (!document.documentElement.lang) out.push(['lang', '<html> has no lang attribute'])
    if (!document.querySelector('[data-ux="help"]')) out.push(['help-link', 'no [data-ux="help"] link (consistent help)'])
    for (const img of document.querySelectorAll('img')) if (!img.hasAttribute('alt') && img.getAttribute('role') !== 'presentation') out.push(['img-alt', `img without alt: ${img.src.slice(0, 60)}`])
    for (const el of document.querySelectorAll('button, a[href], [role="button"], input, select, textarea, summary')) {
      if (!vis(el)) continue
      const b = el.getBoundingClientRect()
      if (b.width < minTarget || b.height < minTarget) out.push(['target-size', `${el.tagName.toLowerCase()} "${(el.innerText || el.getAttribute('aria-label') || '').trim().slice(0, 30)}" is ${Math.round(b.width)}x${Math.round(b.height)}px, need ${minTarget}`])
      const name = (el.innerText || el.getAttribute('aria-label') || el.getAttribute('title') || el.getAttribute('alt') || '').trim()
      if (!name && !el.labels?.length && el.tagName !== 'INPUT') out.push(['accessible-name', `${el.tagName.toLowerCase()} has no accessible name`])
    }
    const small = new Set()
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
    while (walker.nextNode()) {
      const t = walker.currentNode; if (!t.textContent.trim()) continue
      const el = t.parentElement; if (!el || !vis(el)) continue
      const px = parseFloat(getComputedStyle(el).fontSize)
      if (px < 14) small.add(`${el.tagName.toLowerCase()} ${px}px`)
    }
    for (const s of small) out.push(['text-size', `text under 14px: ${s}`])
    const body = parseFloat(getComputedStyle(document.body).fontSize)
    if (body < minBodyPx) out.push(['body-size', `body text ${body}px, need ${minBodyPx}`])
    return out
  }, vp)
  for (const [rule, detail] of res) add(r.name, vpName, rule, detail)

  // --- focus visibility: tab through up to 12 controls; each must show an outline or box-shadow
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press('Tab')
    const f = await page.evaluate(() => {
      const e = document.activeElement; if (!e || e === document.body) return null
      const s = getComputedStyle(e)
      const ring = (s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) >= 2) || (s.boxShadow && s.boxShadow !== 'none')
      return { ok: !!ring, label: (e.innerText || e.getAttribute('aria-label') || e.tagName).trim().slice(0, 30) }
    })
    if (f && !f.ok) add(r.name, vpName, 'focus-visible', `no visible focus ring on "${f.label}"`)
  }
  await page.close()
}
await browser.close(); server?.close()

fs.mkdirSync(path.join(root, 'harness/results'), { recursive: true })
fs.writeFileSync(path.join(root, 'harness/results/G1.a11y.json'), JSON.stringify({ serious }))
fs.writeFileSync(path.join(root, 'harness/results/G1.ux.json'), JSON.stringify({ violations: violations.length, details: violations.slice(0, 50) }, null, 2))
if (violations.length) { for (const v of violations.slice(0, 40)) console.log(`FAIL ${v.route} [${v.viewport}] ${v.rule}: ${v.detail}`); console.log(`\n${violations.length} violation(s)`) }
else console.log('UX lint: no violations')
process.exit(violations.length ? 1 : 0)
