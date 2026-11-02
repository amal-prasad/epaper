// Local operator assertions only. Nothing here approves or records harness evidence.
const fail = message => { throw new Error(message) }
const object = (value, label) => value && typeof value === 'object' && !Array.isArray(value) || fail(`${label} must be an object`)
const text = (value, label) => typeof value === 'string' && value.trim() === value && value.length > 0 || fail(`${label} must be non-empty trimmed text`)
const integer = (value, label, min = 0) => Number.isSafeInteger(value) && value >= min || fail(`${label} must be an integer >= ${min}`)
const number = (value, label, min = 0) => Number.isFinite(value) && value >= min || fail(`${label} must be finite and >= ${min}`)
const timestamp = (value, label) => {
  // An explicit offset prevents timezone-dependent measurements. Reject JS's date rollover.
  text(value, label)
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?(Z|[+-]\d{2}:\d{2})$/.exec(value)
  if (!match) fail(`${label} requires an ISO timestamp with timezone offset`)
  const [, year, month, day, hour, minute, second, zone] = match
  const days = new Date(Date.UTC(Number(year), Number(month), 0)).getUTCDate()
  if (+month < 1 || +month > 12 || +day < 1 || +day > days || +hour > 23 || +minute > 59 || +second > 59 ||
    (zone !== 'Z' && (+zone.slice(1, 3) > 23 || +zone.slice(4) > 59))) fail(`${label} is not a valid timestamp`)
  const ms = Date.parse(value)
  if (!Number.isFinite(ms)) fail(`${label} is not a valid timestamp`)
  return ms
}
const median = values => {
  const sorted = [...values].sort((a, b) => a - b), middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2
}

export function validateIssue(issue) {
  object(issue, 'issue')
  for (const field of ['id', 'publication', 'operator', 'measurementNote']) text(issue[field], field)
  if (!['real', 'synthetic'].includes(issue.kind)) fail('issue kind must be real or synthetic')
  integer(issue.pageCount, 'pageCount', 1)
  if (typeof issue.paid !== 'boolean') fail('paid must be true or false; unpaid issues count too')
  object(issue.pageSize, 'pageSize')
  for (const dimension of ['widthMm', 'heightMm']) {
    number(issue.pageSize[dimension], `pageSize.${dimension}`)
    if (issue.pageSize[dimension] === 0) fail('pageSize dimensions must be positive')
  }
  text(issue.pageSize.basis, 'pageSize.basis')
  const received = timestamp(issue.copyReceivedAt, 'copyReceivedAt')
  const sent = timestamp(issue.pressSentAt, 'pressSentAt')
  const produced = timestamp(issue.producedAt, 'producedAt')
  if (sent < received || produced < sent) fail('copyReceivedAt <= pressSentAt <= producedAt is required')
  if (!Array.isArray(issue.steps) || !issue.steps.length) fail('steps requires measured work durations')
  const intervals = [], names = new Set()
  let activeMinutes = 0
  for (const step of issue.steps) {
    object(step, 'step'); text(step.name, 'step name')
    if (names.has(step.name)) fail(`Duplicate step name: ${step.name}`)
    names.add(step.name)
    const hasMinutes = Object.hasOwn(step, 'minutes')
    const hasInterval = Object.hasOwn(step, 'startAt') || Object.hasOwn(step, 'endAt')
    if (hasMinutes === hasInterval) fail('Each step needs one duration: minutes OR startAt/endAt')
    if (hasMinutes) { number(step.minutes, 'step minutes'); activeMinutes += step.minutes }
    else {
      const start = timestamp(step.startAt, 'step startAt'), end = timestamp(step.endAt, 'step endAt')
      if (end < start || start < received || end > sent) fail('Step interval must be inside the production session and nonnegative')
      intervals.push([start, end]); activeMinutes += (end - start) / 60000
    }
  }
  intervals.sort((a, b) => a[0] - b[0])
  for (let i = 1; i < intervals.length; i++) if (intervals[i][0] < intervals[i - 1][1]) fail('Timed work steps overlap')
  const elapsedMinutes = (sent - received) / 60000
  if (activeMinutes > elapsedMinutes + 1e-8) fail('Step duration sum exceeds the production session')
  integer(issue.storyCount, 'storyCount', 1)
  if (!Array.isArray(issue.stories) || issue.stories.length !== issue.storyCount) fail('storyCount must equal all recorded stories')
  const ids = new Set()
  for (const story of issue.stories) {
    object(story, 'story'); text(story.id, 'story id'); integer(story.manualMoves, 'manualMoves')
    if (!['auto', 'manual', 'unplaced'].includes(story.initialPlacement)) fail('initialPlacement must be auto, manual or unplaced')
    if (ids.has(story.id)) fail(`Duplicate story id: ${story.id}`)
    ids.add(story.id)
  }
  return { elapsedMinutes, activeMinutes }
}

export function validateLedger(ledger) {
  object(ledger, 'ledger')
  if (ledger.schemaVersion !== 1) fail('Unsupported ledger schemaVersion')
  if (!['real', 'synthetic'].includes(ledger.kind)) fail('ledger kind must be real or synthetic')
  if (!Array.isArray(ledger.issues)) fail('ledger issues must be an array')
  const ids = new Set()
  for (const issue of ledger.issues) {
    validateIssue(issue)
    if (issue.kind !== ledger.kind) fail('Issue kind must match ledger kind; keep synthetic examples separate')
    if (ids.has(issue.id)) fail(`Duplicate issue id: ${issue.id}`)
    ids.add(issue.id)
  }
  return ledger
}

export function appendIssue(ledger, issue) {
  validateLedger(ledger); validateIssue(issue)
  if (issue.kind !== ledger.kind) fail('Issue kind must match ledger kind; keep synthetic examples separate')
  if (ledger.issues.some(previous => previous.id === issue.id)) fail(`Duplicate issue id: ${issue.id}; existing records are immutable`)
  return structuredClone({ ...ledger, issues: [...ledger.issues, issue] })
}

export function summarize(ledger) {
  validateLedger(ledger)
  const rows = ledger.issues.map(issue => {
    const durations = validateIssue(issue)
    const autoplacedStories = issue.stories.filter(story => story.initialPlacement === 'auto' && story.manualMoves === 0).length
    return { id: issue.id, producedAt: issue.producedAt, publication: issue.publication, paid: issue.paid,
      pageCount: issue.pageCount, pageSize: structuredClone(issue.pageSize), storyCount: issue.storyCount,
      manualMoves: issue.stories.reduce((total, story) => total + story.manualMoves, 0), autoplacedStories,
      autoplacedPct: autoplacedStories / issue.storyCount * 100,
      elapsedMinutes: durations.elapsedMinutes, activeMinutes: durations.activeMinutes }
  }).sort((a, b) => Date.parse(a.producedAt) - Date.parse(b.producedAt) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
  const window = rows.slice(-4)
  const realFour = ledger.kind === 'real' && window.length === 4
  const eightPageWindow = window.every(row => row.pageCount === 8)
  const baseReason = ledger.kind !== 'real' ? 'Synthetic examples never qualify.' : window.length < 4 ? 'Four real produced issues are required.' : null
  return { schemaVersion: 1, kind: ledger.kind, rows, windowIds: window.map(row => row.id),
    activeMinutesMedian: window.length ? median(window.map(row => row.activeMinutes)) : null,
    minutes: { eligible: realFour && eightPageWindow, median: realFour && eightPageWindow ? median(window.map(row => row.elapsedMinutes)) : null,
      basis: 'Elapsed copy-received-to-press-sent minutes, including waiting; active work is reported separately.',
      reason: baseReason || (!eightPageWindow ? 'The latest four produced issues must all have eight pages; no normalization or older-issue substitution.' : null) },
    placement: { eligible: realFour, median: realFour ? median(window.map(row => row.autoplacedPct)) : null,
      reason: baseReason, basis: 'Median of per-issue percentages; all intended stories, including manual and unplaced, remain in each denominator.' } }
}
