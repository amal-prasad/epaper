import test from 'node:test'
import assert from 'node:assert/strict'
import { markWords, markTitle, nextProblem, pageStatus, describeOp } from '../src/index.js'

const m = (state, overLines = 0, emptyLines = 0) => ({ frameId: 'f', storyId: 's', state, overLines, emptyLines })

test('marks are said in Hindi words with the line count, no percentages', () => {
  assert.equal(markWords(m('over', 6)), '6 पंक्तियाँ ज़्यादा')
  assert.equal(markWords(m('over', 1)), '1 पंक्ति ज़्यादा')
  assert.equal(markWords(m('empty', 0, 4)), '4 पंक्तियाँ खाली')
  assert.equal(markWords(m('empty', 0, 1)), '1 पंक्ति खाली')
  assert.equal(markWords(m('ok')), 'सब ठीक है')
  assert.equal(markWords(m('unfilled')), 'खाली जगह')
  for (const s of ['over', 'empty', 'ok', 'unfilled']) assert.doesNotMatch(markWords(m(s, 3, 3)), /%/)
})

test('each state has a plain title for the side panel', () => {
  assert.equal(markTitle(m('over', 2)), 'खबर थोड़ी बड़ी है')
  assert.equal(markTitle(m('empty', 0, 2)), 'जगह खाली बची है')
  assert.equal(markTitle(m('ok')), 'सब ठीक है')
  assert.equal(markTitle(m('unfilled')), 'यहाँ कोई खबर नहीं')
})

test('an unknown state fails loudly', () => {
  assert.throws(() => markWords(m('weird')), /unknown mark state weird/)
})

const problems = [{ pageId: 'p1', frameId: 'a' }, { pageId: 'p1', frameId: 'b' }, { pageId: 'p2', frameId: 'c' }]

test('the check queue walks problems in order across pages and wraps around', () => {
  assert.deepEqual(nextProblem(problems, null), problems[0])
  assert.deepEqual(nextProblem(problems, { pageId: 'p1', frameId: 'a' }), problems[1])
  assert.deepEqual(nextProblem(problems, { pageId: 'p1', frameId: 'b' }), problems[2])
  assert.deepEqual(nextProblem(problems, { pageId: 'p2', frameId: 'c' }), problems[0])
})

test('from a slot that is not a problem the queue starts at the first problem', () => {
  assert.deepEqual(nextProblem(problems, { pageId: 'p9', frameId: 'z' }), problems[0])
})

test('no problems means nothing to go to', () => {
  assert.equal(nextProblem([], null), null)
})

test('every change is said in a plain sentence for the undo toast and screen readers', () => {
  const doc = { stories: [{ id: 's1', headline: 'योग शिविर' }] }
  assert.equal(describeOp({ type: 'placeStory', args: { frameId: 'f', storyId: null } }, doc), 'खबर हटाई गई')
  assert.equal(describeOp({ type: 'placeStory', args: { frameId: 'f', storyId: 's1' } }, doc), '"योग शिविर" रखी गई')
  assert.equal(describeOp({ type: 'setWrap', args: {} }, doc), 'बदलाव किया गया')
})

test('a page is "problem" when any slot is not ok, else "ok"; colour is never the only signal', () => {
  assert.deepEqual(pageStatus([m('ok'), m('over', 1)]), { state: 'problem', count: 1, icon: '!', words: '1 काम बाकी' })
  assert.deepEqual(pageStatus([m('ok'), m('ok')]), { state: 'ok', count: 0, icon: '✓', words: 'तैयार' })
  assert.deepEqual(pageStatus([m('unfilled'), m('empty', 0, 2)]), { state: 'problem', count: 2, icon: '!', words: '2 काम बाकी' })
})
