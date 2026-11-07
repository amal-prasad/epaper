// Page layout for screens (editor preview, reader view): every line box the engine sets, in CSS px, with no DOM.
// Same defaults, px conversion and object selection as autopage.js measure() and export's render-browser.js, so the screen
// shows the lines the press PDF prints (GG-082). Unlike export it never throws on overflow: the editor marks it (marks.js).
//   pageLayout(doc, pageId, { inks }) -> { w, h (mm), frames, labels, photos, boxes }   inks: fonts/ink.json
import { flow } from './flow.js'
import { layoutHeadline } from './headline.js'
import { frameColumns } from './templates.js'
import { wrapObstacles } from './wrap.js'
import { px } from './autopage.js'

const fontOf = s => `${s.weight} ${s.fontSize}px "${s.family}"`

export function pageLayout(doc, pageId, { inks }) {
  const page = doc.pages.find(p => p.id === pageId)
  if (!page) throw new Error(`no page ${pageId}`)
  const labels = [], photos = [], boxes = []
  for (const object of page.objects) {
    const o = px(object), z = o.z ?? 0, style = object.style ?? {}
    if (['photo', 'ad'].includes(o.kind) && o.src) {
      photos.push({ id: o.id, x: o.x, y: o.y, w: o.w, h: o.h, z, src: o.src, ...(o.wrap?.mode === 'shape' ? { polygon: o.wrap.polygon } : {}) })
      continue
    }
    if (['box', 'line'].includes(o.kind) || style.background)
      boxes.push({ id: o.id, kind: o.kind, x: o.x, y: o.y, w: o.w, h: o.h, z, background: style.background ?? 'transparent' })
    if (['box', 'line'].includes(o.kind)) continue
    const s = { family: 'Noto Sans Devanagari', weight: 400, fontSize: 12, ...style }
    const ink = inks[s.family]?.[s.weight]
    if (!ink) throw new Error(`${o.id}: ink metrics missing for ${s.family} ${s.weight}`)
    const head = layoutHeadline(object.text ?? '', { family: s.family, weight: s.weight, sizes: s.sizes ?? [s.fontSize], width: o.w, height: o.h, ink })
    labels.push({ id: o.id, x: o.x, y: o.y, w: o.w, h: o.h, z, font: fontOf({ ...s, fontSize: head.size }), size: head.size,
      pitch: head.pitch, fits: head.fits, colour: s.colour ?? '#000000', lines: head.lines })
  }
  const frames = page.frames.map(frame => {
    const f = px(frame), s = { family: 'Noto Sans Devanagari', weight: 400, fontSize: 12, lineHeight: 18, ...frame.style }
    const out = { id: f.id, storyId: frame.storyId ?? null, x: f.x, y: f.y, w: f.w, h: f.h, z: f.z ?? 0, font: fontOf(s),
      lineHeight: s.lineHeight, colour: s.colour ?? '#000000', lines: [] }
    if (frame.storyId == null) return out
    const story = doc.stories.find(st => st.id === frame.storyId)
    if (!story) throw new Error(`frame ${frame.id}: no story ${frame.storyId}`)
    const columns = frameColumns(f)
    const obstacles = wrapObstacles(page.objects.filter(o => !o.frameId || o.frameId === frame.id).map(px), columns, { lineHeight: s.lineHeight })
    const { lines } = flow(story.body.join(' '), columns, obstacles, { font: out.font, lineHeight: s.lineHeight })
    // As render-browser.js: justify every line but the last and lines that hug a shape (align set).
    out.lines = lines.map((l, i) => ({ x: l.x, y: l.y, w: l.w, text: l.text.trimEnd(), align: l.align ?? null, justify: !l.align && i < lines.length - 1 }))
    return out
  })
  return { w: doc.preset.page.w, h: doc.preset.page.h, frames, labels, photos, boxes }
}
