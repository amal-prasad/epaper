'use client'
// Draws one page from engine line boxes (pageLayout). Line breaks come only from the engine, never from CSS (rule 2).
// Baselines follow export: ink-centred in the line, using fonts/ink.json.

let ctx
const measure = (font, text) => {
  ctx ??= document.createElement('canvas').getContext('2d')
  ctx.font = font
  return ctx.measureText(text)
}
const sizeOf = font => parseFloat(/([\d.]+)px/.exec(font)[1])
const familyWeight = font => { const [, weight, family] = /^(\d+) [\d.]+px "(.+)"$/.exec(font); return [family, weight] }

function BodyLine({ frame, line, ink }) {
  const m = measure(frame.font, line.text), size = sizeOf(frame.font)
  const baseline = line.y + (frame.lineHeight - size * (ink.top + ink.bottom)) / 2 + size * ink.top
  const spaces = (line.text.match(/ /g) ?? []).length
  const wordSpacing = line.justify && spaces ? (line.w - m.width) / spaces : 0
  return (
    <div data-line="" style={{ position: 'absolute', left: line.x, top: baseline - m.fontBoundingBoxAscent, width: line.w, whiteSpace: 'pre',
      font: frame.font, lineHeight: `${m.fontBoundingBoxAscent + m.fontBoundingBoxDescent}px`, wordSpacing, color: frame.colour,
      textAlign: line.align === 'right' ? 'right' : 'left', zIndex: frame.z }}>{line.text}</div>
  )
}

// children: an overlay in screen px (page px × scale), drawn unscaled so marks and labels keep readable sizes.
export default function PageView({ layout, inks, scale, children }) {
  const PX = 96 / 25.4, W = layout.w * PX, H = layout.h * PX
  const inkOf = font => { const [family, weight] = familyWeight(font); return inks[family][weight] }
  return (
    <div style={{ position: 'relative', width: W * scale, height: H * scale, flexShrink: 0 }}>
      <div role="img" aria-label="पृष्ठ का लेआउट" style={{ position: 'relative', width: W, height: H, transform: `scale(${scale})`, transformOrigin: '0 0',
        background: 'var(--paper)', color: 'var(--paper-ink)', boxShadow: 'var(--shadow-3), 0 0 0 1px rgba(0,0,0,0.04)', borderRadius: 3 }}>
        {layout.boxes.map(b => <div key={b.id} style={{ position: 'absolute', left: b.x, top: b.y, width: b.w, height: b.h, background: b.background, zIndex: b.z }} />)}
        {layout.photos.map(p => <img key={p.id} src={p.src} alt="" style={{ position: 'absolute', left: p.x, top: p.y, width: p.w, height: p.h, objectFit: 'contain', zIndex: p.z,
          clipPath: p.polygon ? `polygon(${p.polygon.map(([x, y]) => `${x * 100}% ${y * 100}%`).join(',')})` : undefined }} />)}
        {layout.labels.map(l => l.lines.map((line, i) => {
          const m = measure(l.font, line.text)
          return <div key={`${l.id}-${i}`} data-line="" style={{ position: 'absolute', left: l.x, top: l.y + line.baseline - m.fontBoundingBoxAscent, whiteSpace: 'pre',
            font: l.font, lineHeight: `${m.fontBoundingBoxAscent + m.fontBoundingBoxDescent}px`, color: l.colour, zIndex: l.z }}>{line.text}</div>
        }))}
        {layout.frames.map(f => f.lines.map((line, i) => <BodyLine key={`${f.id}-${i}`} frame={f} line={line} ink={inkOf(f.font)} />))}
      </div>
      {children}
    </div>
  )
}
