// Fit marks for the editor (docs/design/ui-v2.md §0): per slot, lines over or empty. DOM-free; the caller installs
// font measurement, as for flow(). Line counts only: percentages stay internal (D-080). Any empty line counts (D-083).
// state: 'over' (text left over), 'empty' (spare lines), 'ok' (exactly full), 'unfilled' (no story in the slot).
import { measure } from './autopage.js'

// ponytail: each frame measured on its own; chained frames (nextFrameId) get marks when export supports chains.
export function pageMarks(doc, pageId) {
  const page = doc.pages.find(p => p.id === pageId)
  if (!page) throw new Error(`no page ${pageId}`)
  return page.frames.map(frame => {
    if (frame.storyId == null) return { frameId: frame.id, storyId: null, state: 'unfilled', overLines: 0, emptyLines: 0 }
    const story = doc.stories.find(s => s.id === frame.storyId)
    if (!story) throw new Error(`frame ${frame.id}: no story ${frame.storyId}`)
    const { overflowLines, underfillLines } = measure(story, page, frame)
    const state = overflowLines > 0 ? 'over' : underfillLines > 0 ? 'empty' : 'ok'
    return { frameId: frame.id, storyId: story.id, state, overLines: overflowLines, emptyLines: overflowLines > 0 ? 0 : underfillLines }
  })
}

// Every slot that is not 'ok', in page order: the "जाँच (N)" queue.
export const issueProblems = doc =>
  doc.pages.flatMap(page => pageMarks(doc, page.id).filter(m => m.state !== 'ok').map(m => ({ pageId: page.id, ...m })))
