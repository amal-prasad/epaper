'use client'
import { useEffect, useMemo, useState } from 'react'
import { pageLayout } from '@studio/engine/src/layout.js'
import { pageMarks } from '@studio/engine/src/marks.js'
import { markWords, markTitle, nextProblem, pageStatus } from '@studio/ui'
import PageView from './PageView.js'
import Marks from './Marks.js'

const SAMPLE = 'हिन्दी समाचार English 123'
const SCALE = 0.62
// Every font the issue uses must be loaded before the engine measures, or breaks come from a fallback font (rule 3).
const fontsOf = doc => [...new Set(doc.pages.flatMap(p => [...p.frames, ...p.objects]).map(o => o.style ?? {})
  .map(s => `${s.weight ?? 400} 16px "${s.family ?? 'Noto Sans Devanagari'}"`))]
const chip = { over: ['var(--danger-soft)', 'var(--danger-text)', '⚠'], empty: ['var(--info-soft)', 'var(--info-text)', '◌'],
  unfilled: ['var(--info-soft)', 'var(--info-text)', '◌'], ok: ['var(--success-soft)', 'var(--success-text)', '✓'] }

export default function Editor({ doc, inks }) {
  const [ready, setReady] = useState(false)
  const [error, setError] = useState(null)
  const [pageId, setPageId] = useState(doc.pages[0].id)
  const [selected, setSelected] = useState(null) // frameId on the current page
  const [said, setSaid] = useState('')

  useEffect(() => {
    let live = true
    Promise.all(fontsOf(doc).map(f => document.fonts.load(f, SAMPLE)))
      .then(() => live && setReady(true)).catch(e => live && setError(e.message))
    return () => { live = false }
  }, [doc])

  const marksByPage = useMemo(() => ready ? Object.fromEntries(doc.pages.map(p => [p.id, pageMarks(doc, p.id)])) : null, [ready, doc])
  const layout = useMemo(() => ready ? pageLayout(doc, pageId, { inks }) : null, [ready, doc, pageId, inks])
  const problems = useMemo(() => marksByPage ? doc.pages.flatMap(p => marksByPage[p.id].filter(m => m.state !== 'ok').map(m => ({ pageId: p.id, ...m }))) : [], [marksByPage, doc])
  const page = doc.pages.find(p => p.id === pageId)
  const headlineOf = id => doc.stories.find(s => s.id === id)?.headline ?? id
  const mark = selected && marksByPage?.[pageId].find(m => m.frameId === selected)

  const select = (pid, fid) => {
    setPageId(pid); setSelected(fid)
    const m = fid && marksByPage[pid].find(x => x.frameId === fid)
    if (m) setSaid(`पृष्ठ ${doc.pages.find(p => p.id === pid).no}, ${m.storyId ? headlineOf(m.storyId) : 'खाली जगह'}: ${markWords(m)}`)
  }
  const goNext = () => { const n = nextProblem(problems, selected && { pageId, frameId: selected }); if (n) select(n.pageId, n.frameId) }

  useEffect(() => {
    const key = e => {
      if (e.target.closest?.('input, textarea, [contenteditable]')) return
      if (e.key === 'Escape') setSelected(null)
      if ((e.key === 'n' || e.key === 'N') && !e.ctrlKey && !e.metaKey) goNext()
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <header className="glass" style={{ margin: '16px 16px 0', padding: '8px 10px', borderRadius: 24, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12 }}>
        <span aria-hidden="true" style={{ width: 38, height: 38, borderRadius: 12, background: '#e5483b', color: '#fff', display: 'flex',
          alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 700 }}>अ</span>
        <span style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.4 }}>
          <span style={{ fontSize: 16, color: 'var(--ink-muted)' }}>{doc.id}</span>
          <span style={{ fontWeight: 600 }}>पृष्ठ {page.no}</span>
        </span>
        <span style={{ flex: 1 }} />
        {problems.length > 0
          ? <button type="button" data-ux="primary" onClick={goNext} title="अगली समस्या पर जाएँ (N)" style={primary}>
              जाँच <span style={badge}>{problems.length}</span></button>
          : <button type="button" data-ux="primary" disabled={!ready} title="प्रेस PDF अगले चरण में जुड़ेगा" style={primary}>प्रेस PDF बनाएँ</button>}
      </header>

      <p aria-live="polite" style={vh}>{said}</p>
      {error && <p role="alert" style={{ margin: 16 }}>पृष्ठ नहीं बन सका: {error}</p>}
      {!error && !ready && <p aria-live="polite" style={{ margin: 16 }}>पृष्ठ बन रहा है…</p>}

      {ready && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, padding: 16, alignItems: 'flex-start' }}>
          <aside aria-label="खबरें" className="glass" style={{ ...panel, flex: '1 1 260px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0 4px' }}>
              <span style={{ fontWeight: 600 }}>इस पृष्ठ पर</span>
              <span style={{ fontSize: 16, color: 'var(--ink-muted)' }}>{page.frames.length} जगह</span>
            </div>
            {page.frames.map((f, i) => {
              const m = marksByPage[pageId].find(x => x.frameId === f.id), [bg, fg, icon] = chip[m.state]
              return (
                <button key={f.id} type="button" onClick={() => select(pageId, f.id)} aria-pressed={selected === f.id}
                  style={{ textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 4, padding: 10, border: 0, borderRadius: 20, cursor: 'pointer',
                    background: selected === f.id ? 'var(--surface)' : 'transparent', boxShadow: selected === f.id ? 'inset 0 0 0 2px var(--select), var(--shadow-1)' : 'none' }}>
                  <span style={{ fontSize: 17, lineHeight: '25px', fontWeight: 600 }}>{f.storyId ? headlineOf(f.storyId) : `स्लॉट ${i + 1}`}</span>
                  <span style={{ alignSelf: 'flex-start', padding: '0 9px', borderRadius: 999, background: bg, color: fg, fontSize: 16, lineHeight: '25px', fontWeight: 600 }}>
                    <span aria-hidden="true">{icon} </span>{markWords(m)}</span>
                </button>
              )
            })}
          </aside>

          <main style={{ flex: '999 1 560px', minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
            <nav aria-label="पृष्ठ" className="glass" style={{ display: 'flex', gap: 4, padding: 6, borderRadius: 999, maxWidth: '100%', overflowX: 'auto' }}>
              {doc.pages.map(p => {
                const st = pageStatus(marksByPage[p.id]), cur = p.id === pageId
                return (
                  <button key={p.id} type="button" onClick={() => select(p.id, null)} aria-current={cur ? 'page' : undefined}
                    aria-label={`पृष्ठ ${p.no}, ${st.words}`} title={st.words}
                    style={{ minWidth: 52, height: 48, border: 0, borderRadius: 24, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                      background: cur ? 'var(--primary)' : 'transparent', color: cur ? 'var(--on-primary)' : 'var(--ink)', fontWeight: 600, fontSize: 17 }}>
                    {p.no}<span aria-hidden="true" style={{ fontSize: 14, color: cur ? 'var(--on-primary)' : st.state === 'ok' ? 'var(--success-text)' : 'var(--danger-text)' }}>{st.icon}</span>
                  </button>
                )
              })}
            </nav>
            <div style={{ maxWidth: '100%', overflowX: 'auto', padding: '36px 16px 24px' }}>
              <PageView layout={layout} inks={inks} scale={SCALE}>
                <Marks layout={layout} marks={marksByPage[pageId]} scale={SCALE} selected={selected} onSelect={fid => select(pageId, fid)} headlineOf={headlineOf} />
              </PageView>
            </div>
          </main>

          <aside aria-label="चुनी हुई जगह" className="glass" style={{ ...panel, flex: '1 1 300px' }}>
            {mark ? (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span aria-hidden="true" style={{ width: 46, height: 46, borderRadius: 16, background: chip[mark.state][0], color: chip[mark.state][1],
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>{chip[mark.state][2]}</span>
                  <div><div style={{ fontSize: 21, lineHeight: '29px', fontWeight: 600 }}>{markTitle(mark)}</div>
                    <div style={{ fontSize: 16, lineHeight: '23px', color: 'var(--ink-muted)' }}>{mark.storyId ? headlineOf(mark.storyId) : 'छोटी खबर या फोटो रखें'}</div></div>
                </div>
                {mark.state !== 'ok' && <div style={{ fontSize: 28, lineHeight: '34px', fontWeight: 300, color: chip[mark.state][1] }}>{markWords(mark)}</div>}
                <p style={{ margin: 0, fontSize: 16, color: 'var(--ink-muted)' }}>ठीक करने के तरीके अगले चरण में आएँगे।</p>
              </>
            ) : <p style={{ margin: 0, color: 'var(--ink-muted)' }}>पृष्ठ पर कोई जगह चुनें, या <b>जाँच</b> दबाएँ।</p>}
          </aside>
        </div>
      )}
    </div>
  )
}

const primary = { display: 'flex', alignItems: 'center', gap: 10, minHeight: 46, padding: '0 8px 0 20px', border: 0, borderRadius: 999, cursor: 'pointer',
  background: 'var(--primary)', color: 'var(--on-primary)', fontSize: 18, fontWeight: 600, boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.22), 0 10px 22px -10px rgba(31,50,64,0.5)' }
const badge = { minWidth: 28, height: 28, padding: '0 8px', borderRadius: 14, background: '#a9c3cf', color: '#13212b', fontSize: 16, lineHeight: '28px', fontWeight: 700 }
const panel = { padding: 16, borderRadius: 28, display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0 }
const vh = { position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap' }
