// Every change to a document is an op: { type, args }. apply(doc, op) returns { doc, inverse }; the inverse is itself an op,
// as plain data, so the log can be stored as JSON and replayed. Ops never mutate their input.
import { assertWrap } from './wrap.js'

const fail = message => { throw new Error(message) }

const withPage = (doc, page) => ({ ...doc, pages: doc.pages.map(p => (p.id === page.id ? page : p)) })
const pageById = (doc, id) => doc.pages.find(p => p.id === id) ?? fail(`no page ${id}`)
const pageOfObject = (doc, id) => doc.pages.find(p => p.objects.some(o => o.id === id)) ?? fail(`no object ${id}`)

// The object and everything parented to it, at any depth. A parent and its children live on the same page.
function familyOf(page, id) {
  const ids = new Set([id])
  for (let grew = true; grew;) {
    grew = false
    for (const o of page.objects) if (o.parentId != null && ids.has(o.parentId) && !ids.has(o.id)) { ids.add(o.id); grew = true }
  }
  return page.objects.filter(o => ids.has(o.id))
}

// rot: null records "had no rotation" in a form that survives JSON.
const snapshot = o => ({ id: o.id, x: o.x, y: o.y, w: o.w, h: o.h, rot: o.rot ?? null })

function checkGeometry(patch) {
  for (const key of ['x', 'y', 'w', 'h', 'rot'])
    if (key in patch && !Number.isFinite(patch[key])) fail(`bad geometry: ${key} is ${patch[key]}`)
  for (const key of ['w', 'h'])
    if (key in patch && patch[key] <= 0) fail(`bad geometry: ${key} must be above 0, got ${patch[key]}`)
}

const OPS = {
  // storyId null clears the frame. A story belongs to at most one chain of frames, held on the chain's first frame.
  placeStory(doc, { frameId, storyId }) {
    const page = doc.pages.find(p => p.frames.some(f => f.id === frameId)) ?? fail(`no frame ${frameId}`)
    const frame = page.frames.find(f => f.id === frameId)
    if (storyId != null) {
      const all = doc.pages.flatMap(p => p.frames)
      if (!doc.stories.some(s => s.id === storyId)) fail(`no story ${storyId}`)
      if (all.some(f => f.id !== frameId && f.storyId === storyId)) fail(`story ${storyId} is already placed`)
      if (all.some(f => f.nextFrameId === frameId)) fail(`frame ${frameId} continues another frame`)
    }
    const next = { ...frame }
    if (storyId == null) delete next.storyId
    else next.storyId = storyId
    return {
      doc: withPage(doc, { ...page, frames: page.frames.map(f => (f.id === frameId ? next : f)) }),
      inverse: { type: 'placeStory', args: { frameId, storyId: frame.storyId ?? null } },
    }
  },

  // Sets any of x, y, w, h, rot. Children move and scale with the parent; a parent's rotation is not passed on.
  // The inverse restores saved numbers: recomputing the scale backwards would drift.
  setObjectGeometry(doc, { objectId, ...patch }) {
    checkGeometry(patch)
    const page = pageOfObject(doc, objectId)
    const family = familyOf(page, objectId)
    const old = family.find(o => o.id === objectId)
    const now = { ...old, ...patch }
    const sx = now.w / old.w, sy = now.h / old.h
    const moved = new Map(family.map(o => [o.id, o.id === objectId ? now : {
      ...o,
      x: now.x + (o.x - old.x) * sx, y: now.y + (o.y - old.y) * sy, w: o.w * sx, h: o.h * sy,
    }]))
    return {
      doc: withPage(doc, { ...page, objects: page.objects.map(o => moved.get(o.id) ?? o) }),
      inverse: { type: 'restoreGeometry', args: { pageId: page.id, geometries: family.map(snapshot) } },
    }
  },

  // Inverse of setObjectGeometry (and of itself).
  restoreGeometry(doc, { pageId, geometries }) {
    const page = pageById(doc, pageId)
    const saved = new Map(geometries.map(g => [g.id, g]))
    const objects = page.objects.map(o => {
      const g = saved.get(o.id)
      if (!g) return o
      const { id, rot, ...box } = g
      const next = { ...o, ...box }
      if (rot == null) delete next.rot
      else next.rot = rot
      return next
    })
    const before = page.objects.filter(o => saved.has(o.id)).map(snapshot)
    return { doc: withPage(doc, { ...page, objects }), inverse: { type: 'restoreGeometry', args: { pageId, geometries: before } } }
  },

  setWrap(doc, { objectId, wrap }) {
    assertWrap(wrap)
    const page = pageOfObject(doc, objectId)
    const old = page.objects.find(o => o.id === objectId)
    return {
      doc: withPage(doc, { ...page, objects: page.objects.map(o => (o.id === objectId ? { ...o, wrap } : o)) }),
      inverse: { type: 'setWrap', args: { objectId, wrap: old.wrap } },
    }
  },

  // A block is a page object for now. Children go with their parent.
  removeBlock(doc, { objectId }) {
    const page = pageOfObject(doc, objectId)
    const ids = new Set(familyOf(page, objectId).map(o => o.id))
    const removed = []
    page.objects.forEach((object, index) => { if (ids.has(object.id)) removed.push({ index, object }) })
    return {
      doc: withPage(doc, { ...page, objects: page.objects.filter(o => !ids.has(o.id)) }),
      inverse: { type: 'restoreBlocks', args: { pageId: page.id, objectId, entries: removed } },
    }
  },

  // Inverse of removeBlock. Entries are in ascending index order, so each goes back exactly where it was.
  restoreBlocks(doc, { pageId, objectId, entries }) {
    const page = pageById(doc, pageId)
    const objects = [...page.objects]
    for (const { index, object: entry } of entries) objects.splice(index, 0, entry)
    return {
      doc: withPage(doc, { ...page, objects }),
      inverse: { type: 'removeBlock', args: { objectId } },
    }
  },
}

export function apply(doc, op) {
  if (!Object.hasOwn(OPS, op.type)) fail(`unknown op ${op.type}`)
  return OPS[op.type](doc, op.args)
}

// History: the document, an append-only log of every op applied (undo and redo included, so the log alone replays to
// the document), and the undo and redo stacks. Purely functional. version counts log entries; each entry carries the
// version it was applied on (baseVersion), which is what concurrent editing will need later.
export const startHistory = doc => ({ doc, version: 0, log: [], undoStack: [], redoStack: [] })

function step(h, op) {
  const out = apply(h.doc, op)
  return { out, doc: out.doc, version: h.version + 1, log: [...h.log, { baseVersion: h.version, op }] }   // ponytail: copies the log per op, snapshots will bound it
}

export function run(h, op) {
  const { out, doc, version, log } = step(h, op)
  return { doc, version, log, undoStack: [...h.undoStack, { op, inverse: out.inverse }], redoStack: [] }
}

export function undo(h) {
  const entry = h.undoStack.at(-1)
  if (!entry) return h
  const { doc, version, log } = step(h, entry.inverse)
  return { doc, version, log, undoStack: h.undoStack.slice(0, -1), redoStack: [...h.redoStack, entry] }
}

export function redo(h) {
  const entry = h.redoStack.at(-1)
  if (!entry) return h
  const { out, doc, version, log } = step(h, entry.op)
  return { doc, version, log, undoStack: [...h.undoStack, { op: entry.op, inverse: out.inverse }], redoStack: h.redoStack.slice(0, -1) }
}

export const replay = (start, log) => log.reduce((doc, entry) => apply(doc, entry.op).doc, start)
