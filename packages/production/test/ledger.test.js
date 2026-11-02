import test from 'node:test'
import assert from 'node:assert/strict'
import { appendIssue, summarize, validateIssue } from '../src/ledger.js'

const issue = (id, minutes = 100, extra = {}) => ({
  id, kind: 'real', publication: 'Janshakti Ujala', producedAt: `2026-10-${id.padStart(2, '0')}T12:00:00+05:30`,
  pageCount: 8, pageSize: { widthMm: 297, heightMm: 420, basis: 'Assumed development preset; confirm with printer' },
  paid: false, operator: 'Amal', measurementNote: 'Stopwatch and production notebook',
  copyReceivedAt: `2026-10-${id.padStart(2, '0')}T08:00:00+05:30`,
  pressSentAt: `2026-10-${id.padStart(2, '0')}T12:00:00+05:30`,
  steps: [{ name: 'Layout and export', minutes }], storyCount: 2,
  stories: [{ id: 'lead', initialPlacement: 'auto', manualMoves: 0 }, { id: 'other', initialPlacement: 'manual', manualMoves: 0 }], ...extra
})
const ledger = issues => ({ schemaVersion: 1, kind: 'real', issues })

test('four real produced issues use issue medians, including unpaid Janshakti', () => {
  const summary = summarize(ledger([issue('1', 80), issue('2', 100), issue('3', 160), issue('4', 200)]))
  assert.equal(summary.minutes.eligible, true)
  assert.equal(summary.minutes.median, 240)
  assert.equal(summary.activeMinutesMedian, 130)
  assert.equal(summary.placement.median, 50)
  assert.equal(summary.rows[0].elapsedMinutes, 240)
  assert.equal(summary.rows[0].activeMinutes, 80)
  assert.equal(summary.rows[0].paid, false)
})

test('selects latest four real produced issues first; cannot skip a non-eight-page issue', () => {
  const summary = summarize(ledger([issue('5', 200, { pageCount: 4 }), issue('1'), issue('4'), issue('2'), issue('3')]))
  assert.deepEqual(summary.windowIds, ['2', '3', '4', '5'])
  assert.equal(summary.minutes.eligible, false)
  assert.equal(summary.minutes.median, null)
  assert.equal(summary.placement.eligible, true)
})

test('synthetic records cannot enter real ledgers or qualify even with four issues', () => {
  assert.throws(() => appendIssue(ledger([]), issue('1', 100, { kind: 'synthetic' })), /kind/)
  const summary = summarize({ schemaVersion: 1, kind: 'synthetic', issues: ['1','2','3','4'].map(id => issue(id, 100, { kind: 'synthetic' })) })
  assert.equal(summary.minutes.eligible, false)
  assert.equal(summary.placement.eligible, false)
  assert.equal(summary.minutes.median, null)
})

test('fewer than four issues never provides gate evidence', () => {
  const summary = summarize(ledger([issue('1')]))
  assert.equal(summary.minutes.median, null)
  assert.equal(summary.placement.median, null)
})

test('manual moves and unplaced stories stay in the placement denominator', () => {
  const entry = issue('1', 100, { storyCount: 3, stories: [
    { id: 'a', initialPlacement: 'auto', manualMoves: 0 },
    { id: 'b', initialPlacement: 'auto', manualMoves: 1 },
    { id: 'c', initialPlacement: 'unplaced', manualMoves: 0 }
  ] })
  const summary = summarize(ledger([entry]))
  assert.equal(summary.rows[0].autoplacedStories, 1)
  assert.equal(summary.rows[0].storyCount, 3)
  assert.ok(Math.abs(summary.rows[0].autoplacedPct - 100 / 3) < 1e-10)
})

test('append is immutable and refuses duplicate ids', () => {
  const original = ledger([issue('1')])
  const before = structuredClone(original)
  const next = appendIssue(original, issue('2'))
  assert.deepEqual(original, before)
  next.issues[0].publication = 'changed'
  assert.equal(original.issues[0].publication, 'Janshakti Ujala')
  assert.throws(() => appendIssue(original, issue('1')), /Duplicate issue/)
})

test('validates counts, ids, dates, paid state, dimensions and trustworthy durations', () => {
  for (const change of [
    { pageCount: -1 }, { paid: 'yes' }, { storyCount: 1 }, { stories: [] },
    { steps: [{ name: 'Layout', minutes: -1 }] }, { steps: [{ name: 'Layout', minutes: 300 }] },
    { steps: [{ name: 'Layout', minutes: NaN }] }, { producedAt: '2026-02-30T12:00:00Z' },
    { producedAt: '2026-10-01T12:00:00' }, { pressSentAt: '2026-09-30T12:00:00Z' },
    { pageSize: { widthMm: 0, heightMm: 420, basis: 'Assumed' } },
    { stories: [{ id: 'a', initialPlacement: 'auto', manualMoves: -1 }, { id: 'b', initialPlacement: 'manual', manualMoves: 0 }] },
    { stories: [{ id: 'a', initialPlacement: 'auto', manualMoves: 0 }, { id: 'a', initialPlacement: 'manual', manualMoves: 0 }] }
  ]) assert.throws(() => validateIssue(issue('1', 100, change)), undefined, JSON.stringify(change))
})

test('accepts timed steps, refuses overlapping or out-of-session intervals and ambiguous durations', () => {
  const timed = { name: 'Layout', startAt: '2026-10-01T09:00:00+05:30', endAt: '2026-10-01T10:30:00+05:30' }
  assert.equal(summarize(ledger([issue('1', 100, { steps: [timed] })])).rows[0].activeMinutes, 90)
  assert.throws(() => validateIssue(issue('1', 100, { steps: [timed, { ...timed, name: 'Export' }] })), /overlap/)
  assert.throws(() => validateIssue(issue('1', 100, { steps: [{ ...timed, minutes: 90 }] })), /duration/)
  assert.throws(() => validateIssue(issue('1', 100, { steps: [{ ...timed, endAt: '2026-10-01T13:00:00+05:30' }] })), /session/)
})
