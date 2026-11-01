// Fits a headline to its space. Devanagari must never be clipped: matras reach well above and below the line, so line spacing
// comes from the font's measured ink (fonts/ink.json, scripts/measure-font-ink.mjs), and the size steps down until the headline
// fits. If it fits at no size the result says so and keeps every word; the editor decides, nothing is cut.
//   layoutHeadline(text, { family, weight, sizes: largest first, width, height, ink: { top, bottom } })
//     -> { size, pitch, height, fits, lines: [{ text, baseline, w }] }    baselines measured from the top of the space
import { flow } from './flow.js'

const EPS = 0.01

export function layoutHeadline(text, { family, weight, sizes, width, height, ink }) {
  if (!sizes?.length) throw new Error('layoutHeadline: no sizes to try')
  if (!(width > 0)) throw new Error('layoutHeadline: width must be above 0')
  if (!(ink?.top > 0 && ink?.bottom > 0)) throw new Error('layoutHeadline: ink must have a top and a bottom')
  let result
  for (const size of sizes) {
    const pitch = size * (ink.top + ink.bottom)
    const { lines } = flow(text, [{ id: 'h', x: 0, y: 0, w: width, h: pitch * text.length }], [], { font: `${weight} ${size}px "${family}"`, lineHeight: pitch })
    const height_ = lines.length * pitch
    result = { size, pitch, height: height_, fits: false, lines: lines.map((l, i) => ({ text: l.text.trimEnd(), baseline: size * ink.top + i * pitch, w: l.w })) }
    if (height_ <= height + EPS) return { ...result, fits: true }
  }
  return result
}
