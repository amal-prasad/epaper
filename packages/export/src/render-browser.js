import { flow } from '../../engine/src/flow.js'
import { frameColumns } from '../../engine/src/templates.js'
import { wrapObstacles } from '../../engine/src/wrap.js'
import { layoutHeadline } from '../../engine/src/headline.js'

// All DOM work belongs to the exporter; the shared engine remains DOM-free.
const PX = 96 / 25.4
const px = box => ({ ...box, x: box.x * PX, y: box.y * PX, w: box.w * PX, h: box.h * PX,
  gutter: (box.gutter ?? 0) * PX, wrap: box.wrap && { ...box.wrap,
    offset: Object.fromEntries(Object.entries(box.wrap.offset ?? {}).map(([k, v]) => [k, v * PX])) } })
const ctx = document.createElement('canvas').getContext('2d')
const fontOf = s => `${s.weight ?? 400} ${s.fontSize ?? 12}px "${s.family ?? 'Noto Sans Devanagari'}"`
const el = (parent, tag, css, text) => {
  const node = document.createElement(tag); Object.assign(node.style, css)
  if (text != null) node.textContent = text
  parent.append(node); return node
}
const pos = box => ({ position: 'absolute', left: `${box.x}px`, top: `${box.y}px`, width: `${box.w}px`, height: `${box.h}px` })
const kOf = (node, field = 'color') => {
  const values = getComputedStyle(node)[field].match(/[\d.]+/g)?.map(Number)
  if (!values || values.length > 3 && values[3] !== 1 || values[0] !== values[1] || values[1] !== values[2]) return null
  return 1 - values[0] / 255
}

window.renderExport = async (doc, inks) => {
  const fontRequests = [{ family: 'Noto Sans Devanagari', weight: 400, fontSize: 12 }]
  for (const p of doc.pages) for (const o of [...p.frames, ...p.objects]) fontRequests.push(o.style ?? {})
  for (const s of fontRequests) {
    const loaded = await document.fonts.load(fontOf(s), 'हिन्दी समाचार English 123')
    if (!loaded.length) throw new Error(`font unavailable: ${fontOf(s)}`)
  }
  await document.fonts.ready
  const reports = []
  for (const page of doc.pages) {
    const pg = el(document.body, 'section', { position: 'relative', width: `${doc.preset.page.w}mm`, height: `${doc.preset.page.h}mm`,
      background: 'white', breakAfter: 'page' })
    pg.dataset.pageId = page.id
    const report = { id: page.id, lines: [], objects: [], remainder: '', neutralRegions: [] }
    const register = (id, node, box, field = 'color') => {
      const k = kOf(node, field)
      if (k > 0) report.neutralRegions.push({ id, x: box.x, y: box.y, w: box.w, h: box.h, k })
    }
    const fail = (id, detail) => { throw new Error(`page ${page.id}, ${id}: ${detail}`) }
    for (const object of [...page.objects].sort((a, b) => (a.z ?? 0) - (b.z ?? 0))) {
      const o = px(object), style = object.style ?? {}, boxStyle = { ...pos(o), zIndex: String(o.z ?? 0), background: style.background ?? 'transparent' }
      if (['photo', 'ad'].includes(o.kind) && o.src) {
        const image = el(pg, 'img', { ...boxStyle, objectFit: 'contain' }); image.src = o.src
        if (o.wrap.mode === 'shape') image.style.clipPath = `polygon(${o.wrap.polygon.map(([x, y]) => `${x * 100}% ${y * 100}%`).join(',')})`
        await image.decode().catch(() => fail(o.id, 'asset could not be decoded'))
        const dpi = Math.min(image.naturalWidth / (o.w / 96), image.naturalHeight / (o.h / 96))
        if (dpi < (doc.exportMinImageDpi ?? 150)) fail(o.id, `asset resolution ${dpi.toFixed(1)} dpi is too low`)
        report.objects.push({ id: o.id, kind: o.kind, dpi }); continue
      }
      if (['box', 'line'].includes(o.kind)) { const n = el(pg, 'div', boxStyle); register(o.id, n, o, 'backgroundColor'); continue }
      if (style.background) { const n = el(pg, 'div', boxStyle); register(o.id + '-background', n, o, 'backgroundColor') }
      const s = { family: 'Noto Sans Devanagari', weight: 400, fontSize: 12, ...style }
      const ink = inks[s.family]?.[s.weight]
      if (!ink) fail(o.id, `font ink metrics missing for ${s.family} ${s.weight}`)
      const head = layoutHeadline(o.text, { family: s.family, weight: s.weight, sizes: s.sizes ?? [s.fontSize], width: o.w, height: o.h, ink })
      if (!head.fits) fail(o.id, 'text overflow')
      ctx.font = `${s.weight} ${head.size}px "${s.family}"`
      const headMetrics = head.lines.map(l => ctx.measureText(l.text))
      const headTop = Math.max(0, ...headMetrics.map(m => m.actualBoundingBoxAscent))
      const headBottom = Math.max(0, ...headMetrics.map(m => m.actualBoundingBoxDescent))
      if (headTop + headBottom > head.pitch + 0.01) fail(o.id, 'measured text ink overflow')
      const headBaseline = (head.pitch - headTop - headBottom) / 2 + headTop
      for (const [i, line] of head.lines.entries()) {
        const metric = headMetrics[i], nativeBaseline = (head.pitch - metric.fontBoundingBoxAscent - metric.fontBoundingBoxDescent) / 2 + metric.fontBoundingBoxAscent
        const n = el(pg, 'div', { position: 'absolute', left: `${o.x}px`, top: `${o.y + i * head.pitch + headBaseline - nativeBaseline}px`,
          whiteSpace: 'pre', zIndex: String(o.z ?? 0), font: `${s.weight} ${head.size}px "${s.family}"`, lineHeight: `${head.pitch}px`, color: s.colour ?? '#000000' }, line.text)
        register(`${o.id}-line-${i}`, n, { x: o.x, y: o.y + i * head.pitch, w: ctx.measureText(line.text).width, h: head.pitch })
      }
      report.objects.push({ id: o.id, kind: o.kind, lines: head.lines.length,
        inkTop: o.y + headBaseline - headTop,
        inkBottom: o.y + Math.max(0, head.lines.length - 1) * head.pitch + headBaseline + headBottom })
    }
    for (const frame of page.frames) {
      if (!frame.storyId) continue
      const story = doc.stories.find(s => s.id === frame.storyId), f = px(frame)
      const s = { family: 'Noto Sans Devanagari', weight: 400, fontSize: 12, lineHeight: 18, ...frame.style }
      const ink = inks[s.family]?.[s.weight]
      if (!ink || !(s.fontSize > 0) || !Number.isFinite(s.lineHeight) || s.lineHeight < s.fontSize * (ink.top + ink.bottom))
        fail(frame.id, 'lineHeight must contain the font ink')
      const font = fontOf(s), columns = frameColumns(f)
      const obstacles = wrapObstacles(page.objects.filter(o => !o.frameId || o.frameId === frame.id).map(px), columns, { lineHeight: s.lineHeight })
      const set = flow(story.body.join(' '), columns, obstacles, { font, lineHeight: s.lineHeight })
      if (set.remainder) fail(story.id, 'body overflow')
      ctx.font = font
      const metrics = set.lines.map(l => ctx.measureText(l.text.trimEnd()))
      const topInk = Math.max(0, ...metrics.map(m => m.actualBoundingBoxAscent))
      const bottomInk = Math.max(0, ...metrics.map(m => m.actualBoundingBoxDescent))
      if (topInk + bottomInk > s.lineHeight + 0.01) fail(frame.id, 'lineHeight does not contain measured ink')
      const baselineOffset = (s.lineHeight - topInk - bottomInk) / 2 + topInk
      for (const [i, line] of set.lines.entries()) {
        const text = line.text.trimEnd(), spaces = (text.match(/ /g) ?? []).length
        const ws = spaces && !line.align && i < set.lines.length - 1 ? (line.w - ctx.measureText(text).width) / spaces : 0
        const naturalWidth = ctx.measureText(text).width
        if (naturalWidth > line.w + 0.1) fail(story.id, 'rendered line overflow')
        const m = metrics[i], nativeBaseline = (s.lineHeight - m.fontBoundingBoxAscent - m.fontBoundingBoxDescent) / 2 + m.fontBoundingBoxAscent
        const drawnTop = line.y + baselineOffset - nativeBaseline
        const n = el(pg, 'div', { position: 'absolute', left: `${line.x}px`, top: `${drawnTop}px`, width: `${line.w}px`,
          whiteSpace: 'pre', font, lineHeight: `${s.lineHeight}px`, wordSpacing: `${ws}px`, color: s.colour ?? '#000000',
          zIndex: String(frame.z ?? 0), textAlign: line.align === 'right' ? 'right' : 'left' }, text)
        const range = document.createRange(); range.selectNodeContents(n)
        if (range.getBoundingClientRect().width > line.w + 0.2) fail(story.id, 'DOM line overflow')
        register(`${frame.id}-line-${i}`, n, { x: line.align === 'right' ? line.x + line.w - naturalWidth : line.x,
          y: line.y, w: naturalWidth + ws * spaces, h: s.lineHeight })
        report.lines.push({ ...line, storyId: story.id, wordSpacing: ws, drawnTop,
          baseline: line.y + baselineOffset, inkTop: line.y + baselineOffset - m.actualBoundingBoxAscent,
          inkBottom: line.y + baselineOffset + m.actualBoundingBoxDescent })
      }
    }
    reports.push(report)
  }
  return reports
}
