'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import { pageLayout } from '@studio/engine/src/layout.js'
import { pageMarks, issueProblems } from '@studio/engine/src/marks.js'
import { startHistory, run, undo, redo } from '@studio/engine/src/ops.js'
import { markWords, markTitle, nextProblem, pageStatus, describeOp } from '@studio/ui'
import PageView from './PageView.js'
import Marks from './Marks.js'

const SAMPLE = 'हिन्दी समाचार English 123'
const SCALE = 0.62
// Every font the issue uses must be loaded before the engine measures, or breaks come from a fallback font (rule 3).
const fontsOf = doc => [...new Set(doc.pages.flatMap(p => [...p.frames, ...p.objects]).map(o => o.style ?? {})
  .map(s => `${s.weight ?? 400} 16px "${s.family ?? 'Noto Sans Devanagari'}"`))]
const chip = { over: ['var(--danger-soft)', 'var(--danger-text)', '⚠'], empty: ['var(--info-soft)', 'var(--info-text)', '◌'],
  unfilled: ['var(--info-soft)', 'var(--info-text)', '◌'], ok: ['var(--success-soft)', 'var(--success-text)', '✓'] }

export default function Editor({ doc: initial, inks }) {
  const [ready, setReady] = useState(false)
  const [error, setError] = useState(null)
  // Every change is an engine op on this history, so undo and redo are the engine's (rule 1).
  // ponytail: history lives in memory; saving to the local store is the next slice (G20 save status).
  const [history, setHistory] = useState(() => startHistory(initial))
  const doc = history.doc
  const [pageId, setPageId] = useState(initial.pages[0].id)
  const [selected, setSelected] = useState(null) // frameId on the current page
  const [said, setSaid] = useState('')
  const [toast, setToast] = useState(null)
  const toastTimer = useRef(null)

  useEffect(() => {
    let live = true
    // As export: a face that does not load is fatal, or the engine would measure a fallback font and break lines unlike print.
    Promise.all(fontsOf(initial).map(async f => { if (!(await document.fonts.load(f, SAMPLE)).length) throw new Error(`फ़ॉन्ट नहीं मिला: ${f}`) }))
      .then(() => live && setReady(true)).catch(e => live && setError(e.message))
    return () => { live = false }
  }, [initial])

  const tell = text => {
    setSaid(text); setToast(text)
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 8000) // UX_SPEC F6: 8 s
  }
  const change = op => { setHistory(h => run(h, op)); tell(describeOp(op, doc)) }
  const undoLast = () => {
    const entry = history.undoStack.at(-1)
    if (!entry) return
    setHistory(undo); setToast(null); setSaid(`वापस लिया: ${describeOp(entry.op, doc)}`)
  }
  const redoLast = () => {
    const entry = history.redoStack.at(-1)
    if (!entry) return
    setHistory(redo); setSaid(`फिर से किया: ${describeOp(entry.op, doc)}`)
  }

  const marksByPage = useMemo(() => ready ? Object.fromEntries(doc.pages.map(p => [p.id, pageMarks(doc, p.id)])) : null, [ready, doc])
  const layout = useMemo(() => ready ? pageLayout(doc, pageId, { inks }) : null, [ready, doc, pageId, inks])
  const problems = useMemo(() => ready ? issueProblems(doc) : [], [ready, doc])
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
      const mod = e.ctrlKey || e.metaKey, k = e.key.toLowerCase()
      if (mod && k === 'z' && !e.shiftKey) { e.preventDefault(); undoLast(); return }
      if (mod && (k === 'y' || (k === 'z' && e.shiftKey))) { e.preventDefault(); redoLast(); return }
      if (e.key === 'Escape') setSelected(null)
      if (k === 'n' && !mod) goNext()
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
        <div role="group" aria-label="बदलाव" style={{ display: 'flex', gap: 6 }}>
          <button type="button" onClick={undoLast} disabled={!history.undoStack.length} title="पिछला बदलाव वापस लें (Ctrl Z)" style={quiet}>
            <span aria-hidden="true">↶</span> वापस</button>
          <button type="button" onClick={redoLast} disabled={!history.redoStack.length} title="फिर से करें (Ctrl Y)" style={quiet}>
            <span aria-hidden="true">↷</span> फिर से</button>
        </div>
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
                {mark.storyId && <button type="button" onClick={() => change({ type: 'placeStory', args: { frameId: mark.frameId, storyId: null } })}
                  style={{ ...quiet, alignSelf: 'flex-start' }}>स्लॉट खाली करें</button>}
              </>
            ) : <p style={{ margin: 0, color: 'var(--ink-muted)' }}>पृष्ठ पर कोई जगह चुनें, या <b>जाँच</b> दबाएँ।</p>}
          </aside>
        </div>
      )}

      {toast && (
        <div role="status" style={{ position: 'fixed', left: '50%', bottom: 28, transform: 'translateX(-50%)', zIndex: 50, display: 'flex', alignItems: 'center',
          gap: 12, minHeight: 56, padding: '0 8px 0 20px', borderRadius: 999, background: 'var(--primary)', color: 'var(--on-primary)', boxShadow: 'var(--shadow-3)', whiteSpace: 'nowrap' }}>
          <span>{toast}</span>
          <button type="button" onClick={undoLast} style={{ minHeight: 42, padding: '0 16px', border: 0, borderRadius: 999, cursor: 'pointer',
            background: 'rgba(255,255,255,0.14)', color: 'var(--on-primary)', fontSize: 17, fontWeight: 600 }}>वापस लाएँ</button>
        </div>
      )}
    </div>
  )
}

const quiet = { display: 'flex', alignItems: 'center', gap: 6, minHeight: 42, padding: '0 14px', border: 0, borderRadius: 999, cursor: 'pointer',
  background: 'var(--surface)', color: 'var(--ink)', fontSize: 16, fontWeight: 600, boxShadow: 'inset 0 1px 0 var(--glass-hi), var(--shadow-1)' }

const primary = { display: 'flex', alignItems: 'center', gap: 10, minHeight: 46, padding: '0 8px 0 20px', border: 0, borderRadius: 999, cursor: 'pointer',
  background: 'var(--primary)', color: 'var(--on-primary)', fontSize: 18, fontWeight: 600, boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.22), 0 10px 22px -10px rgba(31,50,64,0.5)' }
const badge = { minWidth: 28, height: 28, padding: '0 8px', borderRadius: 14, background: '#a9c3cf', color: '#13212b', fontSize: 16, lineHeight: '28px', fontWeight: 700 }
const panel = { padding: 16, borderRadius: 28, display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0 }
const vh = { position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap' }
