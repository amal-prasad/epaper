import { prepareWithSegments, layoutWithLines, layoutNextLine, clearCache, setLocale } from '@chenglou/pretext'

const SEG = new Intl.Segmenter('hi', { granularity: 'grapheme' })
const trim = s => s.replace(/\s+$/u, '').replace(/^\s+/u, '')

async function loadFont(family, size, weight = 400) {
  const f = `${weight} ${size}px "${family}"`
  await Promise.all([document.fonts.load(f, 'अआइक्षत्रज्ञश्र'), document.fonts.load(f, 'AQI 2026.,‘’—')])
}
const fontStr = (font, size, weight = 400) => `${weight} ${size}px "${font}"`

// ---- DOM ground truth: read real browser line breaks off a painted paragraph
function domLines(el) {
  const node = el.firstChild
  const text = node.textContent
  const out = []
  let cur = '', prevTop = null, lh = parseFloat(getComputedStyle(el).lineHeight)
  const range = document.createRange()
  for (const { segment, index } of SEG.segment(text)) {
    range.setStart(node, index)
    range.setEnd(node, index + segment.length)
    const rects = range.getClientRects()
    if (!rects.length) { cur += segment; continue }          // collapsed space at line end
    const top = rects[0].top
    if (prevTop !== null && top > prevTop + lh / 2) { out.push(trim(cur)); cur = '' }
    cur += segment
    prevTop = top
  }
  if (trim(cur)) out.push(trim(cur))
  return out
}

function mkPara(text, font, size, lh, width, extraStyle = '', weight = 400) {
  const el = document.createElement('div')
  el.lang = 'hi'
  el.style.cssText = `font:${weight} ${size}px/${lh}px "${font}";width:${width}px;overflow-wrap:break-word;white-space:normal;${extraStyle}`
  el.textContent = text
  return el
}

const stage = () => document.getElementById('stage')

// ---- Test 1: fixed-width column, Pretext vs DOM
window.runColumn = async ({ text, font, size, lh, width, weight = 400 }) => {
  await loadFont(font, size, weight)
  const el = mkPara(text, font, size, lh, width, '', weight)
  stage().appendChild(el)
  const dom = domLines(el)
  const domH = el.getBoundingClientRect().height
  el.remove()
  const p = prepareWithSegments(text, fontStr(font, size, weight))
  const r = layoutWithLines(p, width, lh)
  const pre = r.lines.map(l => trim(l.text))
  return cmp(dom, pre, domH, r.height)
}

// ---- Test 2: obstacle (float) — variable width per line via layoutNextLine
// Obstacle: box at top-left, obsW x obsH, with `gap` margin. DOM reference = real CSS float.
window.runObstacle = async ({ text, font, size, lh, width, obsW, obsH, gap, weight = 400 }) => {
  await loadFont(font, size, weight)
  const wrap = document.createElement('div')
  wrap.style.cssText = `width:${width}px;position:relative`
  const fl = document.createElement('div')
  fl.style.cssText = `float:left;width:${obsW}px;height:${obsH}px;margin:0 ${gap}px ${gap}px 0`
  const para = mkPara(text, font, size, lh, width, '', weight)
  wrap.append(fl, para)
  stage().appendChild(wrap)
  const dom = domLines(para)
  wrap.remove()
  const p = prepareWithSegments(text, fontStr(font, size, weight))
  const pre = []
  let cursor = { segmentIndex: 0, graphemeIndex: 0 }, y = 0
  for (;;) {
    const w = y < obsH + gap ? width - obsW - gap : width      // float affects lines overlapping it vertically
    const line = layoutNextLine(p, w, cursor)
    if (!line) break
    pre.push(trim(line.text)); cursor = line.end; y += lh
  }
  return cmp(dom, pre, null, null)
}

// ---- Perf: how fast is re-layout when an obstacle moves (drag simulation)
window.runPerf = async ({ text, font, size, lh, width, frames }) => {
  await loadFont(font, size)
  const p = prepareWithSegments(text, `${size}px "${font}"`)
  let linesLast = 0
  const t0 = performance.now()
  for (let f = 0; f < frames; f++) {
    let n = 0
    const obsW = 60 + (f % 80), obsH = 40 + (f % 60)
    let cursor = { segmentIndex: 0, graphemeIndex: 0 }, y = 0
    for (;;) {
      const w = y < obsH ? width - obsW : width
      const line = layoutNextLine(p, w, cursor)
      if (!line) break
      cursor = line.end; y += lh; n++
    }
    linesLast = n
  }
  const ms = performance.now() - t0
  return { frames, linesPerFrame: linesLast, totalMs: +ms.toFixed(2), msPerFrame: +(ms / frames).toFixed(3) }
}

function cmp(dom, pre, domH, preH) {
  let firstDiff = -1
  const n = Math.max(dom.length, pre.length)
  for (let i = 0; i < n; i++) if (dom[i] !== pre[i]) { firstDiff = i; break }
  return {
    match: firstDiff === -1, domLines: dom.length, preLines: pre.length, firstDiff,
    domAt: firstDiff >= 0 ? dom[firstDiff] ?? null : null,
    preAt: firstDiff >= 0 ? pre[firstDiff] ?? null : null,
    domH, preH,
  }
}

// ---- width probe: DOM span width vs canvas measureText for single words (the primitive Pretext depends on)
window.runWords = async ({ words, font, size, weight = 400 }) => {
  await loadFont(font, size, weight)
  const ctx = document.createElement('canvas').getContext('2d'); ctx.font = fontStr(font, size, weight)
  return words.map(w => {
    const sp = document.createElement('span'); sp.lang = 'hi'
    sp.style.cssText = `font:${weight} ${size}px "${font}";white-space:nowrap;position:absolute`; sp.textContent = w
    document.body.appendChild(sp); const dw = sp.getBoundingClientRect().width; sp.remove()
    return Math.abs(ctx.measureText(w).width - dw) <= 0.05
  })
}

setLocale('hi')
window.spikeReady = true
