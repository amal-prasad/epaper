// Editor wording and state, pure and DOM-free (docs/design/ui-v2.md §0). Hindi strings live here, not in the engine.
// Marks are line counts said in words; no percentages reach the operator (D-080).

const lines = n => (n === 1 ? '1 पंक्ति' : `${n} पंक्तियाँ`)
const WORDS = {
  over: m => `${lines(m.overLines)} ज़्यादा`,
  empty: m => `${lines(m.emptyLines)} खाली`,
  ok: () => 'सब ठीक है',
  unfilled: () => 'खाली जगह',
}
const TITLES = { over: 'खबर थोड़ी बड़ी है', empty: 'जगह खाली बची है', ok: 'सब ठीक है', unfilled: 'यहाँ कोई खबर नहीं' }

export function markWords(mark) {
  const say = WORDS[mark.state]
  if (!say) throw new Error(`unknown mark state ${mark.state}`)
  return say(mark)
}

export const markTitle = mark => TITLES[mark.state] ?? markWords(mark)

// The "जाँच (N)" queue: the problem after `current`, wrapping; the first one when current is not a problem.
export function nextProblem(problems, current) {
  if (!problems.length) return null
  const i = current ? problems.findIndex(p => p.pageId === current.pageId && p.frameId === current.frameId) : -1
  return problems[(i + 1) % problems.length]
}

// A change said as a sentence, for the undo toast and aria-live (rule 5: changes are listed).
// ponytail: only placeStory has its own words; other ops get a generic sentence until the UI can make them.
export function describeOp(op, doc) {
  if (op.type === 'placeStory') {
    if (op.args.storyId == null) return 'खबर हटाई गई'
    return `"${doc.stories.find(s => s.id === op.args.storyId)?.headline ?? op.args.storyId}" रखी गई`
  }
  return 'बदलाव किया गया'
}

// For the page strip: an icon and words as well as colour (UX_SPEC §2.9).
export function pageStatus(marks) {
  const count = marks.filter(m => m.state !== 'ok').length
  return count ? { state: 'problem', count, icon: '!', words: `${count} काम बाकी` } : { state: 'ok', count: 0, icon: '✓', words: 'तैयार' }
}
