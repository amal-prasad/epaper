// Additive auto-page v0. Proposals use existing ops; accepting and undoing is the editor's normal history path.
// DOM-free; like flow(), font measurement must be installed by the caller (real bundled fonts in production).
import { assertDoc } from './doc.js'
import { apply } from './ops.js'
import { fit, flow } from './flow.js'
import { frameColumns } from './templates.js'
import { wrapObstacles } from './wrap.js'

const PX = 96 / 25.4
const compare = (a, b) => a < b ? -1 : a > b ? 1 : 0
const priority = item => item.priority ?? 2
const px = box => ({ ...box, x: box.x * PX, y: box.y * PX, w: box.w * PX, h: box.h * PX,
  gutter: (box.gutter ?? 0) * PX, wrap: box.wrap && { ...box.wrap,
    offset: Object.fromEntries(Object.entries(box.wrap.offset ?? {}).map(([key, value]) => [key, value * PX])) } })
const fail = message => { throw new Error(`autopage: ${message}`) }
const bounded = (n, max, what) => { if (!Number.isInteger(n) || n < 1 || n > max) fail(`${what} must be from 1 to ${max}`) }
function unique(records, what) {
  const ids = new Set()
  for (const record of records) {
    if (typeof record.id !== 'string' || !record.id) fail(`${what} needs a string id`)
    if (ids.has(record.id)) fail(`duplicate ${what} id ${record.id}`)
    ids.add(record.id)
  }
  return ids
}

// Exported so the editor's fit marks (marks.js) measure a slot exactly as auto-page and export do.
export function measure(story, page, frame) {
  // These defaults, px conversion and object selection match render-browser.js. Sizes are pixels, document boxes are mm.
  const style = { family: 'Noto Sans Devanagari', weight: 400, fontSize: 12, lineHeight: 18, ...frame.style }
  if (!(Number.isFinite(style.fontSize) && style.fontSize > 0 && Number.isFinite(style.lineHeight) && style.lineHeight > 0))
    fail(`invalid typography on ${frame.id}`)
  if (Math.floor(frame.h * PX / style.lineHeight) * frame.cols > 10000) fail(`too many line slots on ${frame.id}`)
  const columns = frameColumns(px(frame))
  const obstacles = wrapObstacles(page.objects.filter(o => !o.frameId || o.frameId === frame.id).map(px), columns, { lineHeight: style.lineHeight })
  const options = { font: `${style.weight} ${style.fontSize}px "${style.family}"`, lineHeight: style.lineHeight }
  const result = fit(story.body.join(' '), columns, obstacles, options)
  const { remainder } = flow(story.body.join(' '), columns, obstacles, options)
  // Keep proposals JSON-safe even if an obstacle removes all text capacity.
  return { ...result, fillPct: Number.isFinite(result.fillPct) ? result.fillPct : null, overflowChars: remainder.length }
}

/**
 * autopage({doc, locks?: frameId[], pageLocks?: pageId[], templates?: {[pageId]: template}, maxFitChecks?: number})
 * Existing placements are preserved, including overflow. Only empty unlocked slots receive unplaced stories.
 * No copy edits, chains, new pages, frame resizing or photo changes are made. See docs/autopage.md.
 */
export function autopage({ doc, locks = [], pageLocks = [], templates = {}, maxFitChecks = 2000 }) {
  assertDoc(doc)
  bounded(maxFitChecks, 10000, 'maxFitChecks')
  if (doc.stories.length > 256 || doc.pages.length > 64) fail('v0 limit is 256 stories and 64 pages')
  const storyIds = unique(doc.stories, 'story'), pageIds = unique(doc.pages, 'page')
  const initialFrames = doc.pages.flatMap(p => p.frames), frameIds = unique(initialFrames, 'frame')
  if (initialFrames.length > 256) fail('v0 limit is 256 frames')
  if (!Array.isArray(locks) || !Array.isArray(pageLocks)) fail('locks and pageLocks must be ID lists')
  const locked = new Set(locks), lockedPages = new Set(pageLocks)
  for (const id of locked) if (!frameIds.has(id)) fail(`unknown locked frame ${id}`)
  for (const id of lockedPages) if (!pageIds.has(id)) fail(`unknown locked page ${id}`)
  if (!templates || typeof templates !== 'object' || Array.isArray(templates)) fail('templates must be a page-ID map')
  for (const [id, template] of Object.entries(templates)) {
    if (!pageIds.has(id)) fail(`unknown template page ${id}`)
    if (!template || !Number.isInteger(template.rows) || template.rows < 1 || template.rows > 1000 ||
      !Array.isArray(template.slots) || template.slots.length > 256 || template.columns > 64) fail(`template ${id} exceeds v0 bounds`)
  }
  if (doc.pages.reduce((n, page) => n + page.objects.length, 0) > 4096) fail('v0 limit is 4096 page objects')
  for (const page of doc.pages) for (const object of page.objects) {
    if ((object.wrap.polygon?.length ?? 0) > 256) fail(`v0 polygon limit exceeded on ${object.id}`)
    if (object.rot) fail(`rotated object unsupported by export (${object.id})`)
  }
  for (const story of doc.stories) {
    if (!Array.isArray(story.body) || !story.body.every(p => typeof p === 'string')) fail(`${story.id} body must be plain paragraphs`)
    if (story.body.join(' ').length > 20000) fail(`${story.id} exceeds the v0 20000-character limit`)
    if (![1, 2, 3].includes(priority(story))) fail(`invalid story priority ${story.id}`)
  }
  for (const frame of initialFrames) {
    if (frame.nextFrameId != null) fail(`continuation chains are unsupported (${frame.id})`)
    if (frame.storyId != null && !storyIds.has(frame.storyId)) fail(`unknown placed story ${frame.storyId}`)
  }
  let proposed = doc, fitChecks = 0
  const ops = [], inverses = [], changes = [], placements = [], unplaced = [], unresolvedOverflow = []
  const add = (op, change) => {
    const applied = apply(proposed, op)
    proposed = applied.doc; ops.push(op); inverses.unshift(applied.inverse)
    changes.push({ opIndex: ops.length - 1, ...change })
  }
  for (const page of [...doc.pages].sort((a, b) => compare(a.no ?? 0, b.no ?? 0) || compare(a.id, b.id))) {
    if (!Object.hasOwn(templates, page.id)) continue
    if (lockedPages.has(page.id) || page.locked) fail(`cannot template locked page ${page.id}`)
    if (page.frames.length || page.objects.length) fail(`template requires an entirely empty page (${page.id})`)
    add({ type: 'applyTemplate', args: { pageId: page.id, template: templates[page.id] } },
      { kind: 'template', pageId: page.id, templateId: templates[page.id].id })
  }
  const slots = proposed.pages.flatMap(page => page.frames.map(frame => ({ page, frame })))
  if (slots.length > 256) fail('v0 limit is 256 frames after templates')
  unique(slots.map(s => s.frame), 'frame')
  for (const { frame } of slots) {
    if (![1, 2, 3].includes(priority(frame))) fail(`invalid slot priority ${frame.id}`)
    for (const key of ['x', 'y', 'w', 'h']) if (!Number.isFinite(frame[key])) fail(`invalid geometry ${frame.id}`)
    if (!(frame.x >= 0 && frame.y >= 0 && frame.w > 0 && frame.h > 0 &&
      frame.x + frame.w <= doc.preset.page.w + 0.01 && frame.y + frame.h <= doc.preset.page.h + 0.01 &&
      Number.isInteger(frame.cols) && frame.cols > 0 && frame.cols <= 64 &&
      Number.isFinite(frame.gutter ?? 0) && (frame.gutter ?? 0) >= 0 && frame.w > (frame.cols - 1) * (frame.gutter ?? 0)))
      fail(`invalid columns ${frame.id}`)
    if (frame.rot) fail(`rotated frame unsupported (${frame.id})`)
  }
  slots.sort((a, b) => priority(a.frame) - priority(b.frame) || compare(a.page.no ?? 0, b.page.no ?? 0) ||
    compare(a.page.id, b.page.id) || compare(a.frame.id, b.frame.id))
  const used = new Set(), usedFrames = new Set()
  const isLocked = ({ page, frame }) => locked.has(frame.id) || lockedPages.has(page.id) || !!frame.locked || !!page.locked
  for (const slot of slots) {
    const { page, frame } = slot
    if (frame.storyId == null) continue
    const story = doc.stories.find(s => s.id === frame.storyId), measured = measure(story, page, frame)
    const placement = { storyId: story.id, pageId: page.id, frameId: frame.id, existing: true, locked: isLocked(slot), fit: measured }
    placements.push(placement); used.add(story.id)
    if (measured.overflowChars) unresolvedOverflow.push({ ...placement, reason: 'existing-overflow' })
  }
  const free = slots.filter(s => s.frame.storyId == null && !isLocked(s))
  for (const story of [...doc.stories].filter(s => !used.has(s.id)).sort((a, b) => priority(a) - priority(b) || compare(a.id, b.id))) {
    if (!story.body.join(' ').trim()) { unplaced.push({ storyId: story.id, reason: 'empty-copy' }); continue }
    let chosen, bestFit, exhausted = false
    for (const slot of free) {
      if (usedFrames.has(slot.frame.id)) continue
      if (fitChecks >= maxFitChecks) { exhausted = true; break }
      fitChecks++
      const measured = measure(story, slot.page, slot.frame)
      if (!bestFit || measured.overflowLines < bestFit.overflowLines) bestFit = { ...measured, pageId: slot.page.id, frameId: slot.frame.id }
      if (!measured.overflowChars) { chosen = { ...slot, measured }; break }
    }
    if (!chosen) {
      unplaced.push({ storyId: story.id, reason: exhausted ? 'budget-exhausted' : bestFit ? 'overflow' : 'no-slot', ...(bestFit ? { bestFit } : {}) })
      continue
    }
    const { page, frame, measured } = chosen
    add({ type: 'placeStory', args: { frameId: frame.id, storyId: story.id } },
      { kind: 'place-story', storyId: story.id, pageId: page.id, frameId: frame.id, before: null, after: story.id, fit: measured })
    placements.push({ storyId: story.id, pageId: page.id, frameId: frame.id, existing: false, locked: false, fit: measured })
    used.add(story.id); usedFrames.add(frame.id)
  }
  return { doc: proposed, ops, inverses, changes, placements, unplaced, unresolvedOverflow, fitChecks,
    pages: proposed.pages.map(page => ({ pageId: page.id, placements: placements.filter(p => p.pageId === page.id) })) }
}
