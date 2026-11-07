'use client'
import { useEffect, useState } from 'react'
import { pageLayout } from '@studio/engine/src/layout.js'
import PageView from './PageView.js'

const SAMPLE = 'हिन्दी समाचार English 123'
// Every font the page uses must be loaded before the engine measures, or line breaks come from a fallback font (rule 3).
const fontsOf = page => [...new Set([...page.frames, ...page.objects].map(o => o.style ?? {})
  .map(s => `${s.weight ?? 400} 16px "${s.family ?? 'Noto Sans Devanagari'}"`))]

export default function Editor({ doc, inks }) {
  const [pageNo] = useState(0)
  const [layout, setLayout] = useState(null)
  const [error, setError] = useState(null)
  const page = doc.pages[pageNo]

  useEffect(() => {
    let live = true
    Promise.all(fontsOf(page).map(f => document.fonts.load(f, SAMPLE)))
      .then(() => { if (live) setLayout(pageLayout(doc, page.id, { inks })) })
      .catch(e => { if (live) setError(e.message) })
    return () => { live = false }
  }, [doc, page, inks])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <header className="glass" style={{ margin: '16px 16px 0', padding: '8px 16px', borderRadius: 24, display: 'flex', alignItems: 'center', gap: 12 }}>
        <span aria-hidden="true" style={{ width: 38, height: 38, borderRadius: 12, background: '#e5483b', color: '#fff', display: 'flex',
          alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 700 }}>अ</span>
        <span style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.4 }}>
          <span style={{ fontSize: 16, color: 'var(--ink-muted)' }}>{doc.id}</span>
          <span style={{ fontWeight: 600 }}>पृष्ठ {page.no}</span>
        </span>
      </header>
      <main style={{ flex: 1, display: 'flex', justifyContent: 'center', padding: 16, overflow: 'auto' }}>
        {error && <p role="alert">पृष्ठ नहीं बन सका: {error}</p>}
        {!error && !layout && <p aria-live="polite">पृष्ठ बन रहा है…</p>}
        {layout && <PageView layout={layout} inks={inks} scale={0.62} />}
      </main>
    </div>
  )
}
