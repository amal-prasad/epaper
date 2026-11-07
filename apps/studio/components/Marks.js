'use client'
// Fit marks and slot selection over the page (ui-v2.md §3.4). Each mark is words + icon + colour, never colour alone.
import { markWords } from '@studio/ui'

const look = {
  over: { ring: '0 0 0 2px var(--danger)', pillBg: 'var(--danger)', pillFg: '#fff', icon: '⚠' },
  empty: { ring: '0 0 0 2px var(--info)', dashed: true, pillBg: 'var(--info-soft)', pillFg: 'var(--info-text)', icon: '◌' },
  unfilled: { hatch: true, ring: '0 0 0 2px var(--info)', dashed: true, pillBg: 'var(--info-soft)', pillFg: 'var(--info-text)', icon: '◌' },
  ok: { pillBg: 'var(--success-soft)', pillFg: 'var(--success-text)', icon: '✓' },
}

export default function Marks({ layout, marks, scale, selected, onSelect, headlineOf }) {
  return layout.frames.map((f, i) => {
    const mark = marks.find(m => m.frameId === f.id), L = look[mark.state], words = markWords(mark)
    const box = { left: f.x * scale, top: f.y * scale, width: f.w * scale, height: f.h * scale }
    const isSel = selected === f.id
    return (
      <div key={f.id} style={{ position: 'absolute', ...box }}>
        {L.ring && <div aria-hidden="true" style={{ position: 'absolute', inset: 0, borderRadius: 2, boxShadow: L.dashed ? 'none' : L.ring,
          border: L.dashed ? '2px dashed var(--info)' : 'none',
          background: L.hatch ? 'repeating-linear-gradient(135deg, rgba(28,111,214,0.12) 0 6px, rgba(28,111,214,0) 6px 12px)' : 'transparent' }} />}
        {mark.state !== 'ok' && (
          <span data-mark={mark.state} style={{ position: 'absolute', left: '50%', bottom: mark.state === 'unfilled' ? 6 : -14, transform: 'translateX(-50%)',
            whiteSpace: 'nowrap', padding: '1px 12px', borderRadius: 999, background: L.pillBg, color: L.pillFg, fontSize: 15, lineHeight: '23px',
            fontWeight: 600, boxShadow: 'var(--shadow-1)', pointerEvents: 'none', zIndex: 2 }}>
            <span aria-hidden="true">{L.icon} </span>{words}
          </span>
        )}
        <button type="button" onClick={() => onSelect(f.id)} aria-pressed={isSel}
          aria-label={`स्लॉट ${i + 1}, ${f.storyId ? headlineOf(f.storyId) : 'कोई खबर नहीं'}: ${words}`}
          style={{ position: 'absolute', inset: -6, border: isSel ? '2px solid var(--select)' : '2px solid transparent', borderRadius: 6,
            background: 'transparent', cursor: 'pointer', padding: 0, zIndex: 1 }}>
          {isSel && <span style={{ position: 'absolute', left: -2, top: -30, padding: '1px 10px', borderRadius: 999, background: '#fff',
            border: '2px solid var(--select)', fontSize: 14, lineHeight: '21px', fontWeight: 600, whiteSpace: 'nowrap', color: '#1a1a1a' }}>
            स्लॉट {i + 1}, {f.cols} कॉलम</span>}
        </button>
      </div>
    )
  })
}
