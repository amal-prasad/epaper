// The document (one issue) as plain JSON. Geometry in millimetres from the top-left of the trim box.
//   { schemaVersion, id, orgId, stories: Story[], pages: [{ id, orgId, no, frames: Frame[], objects: PageObject[] }] }
// Field lists are in docs/PRODUCT_PROMPT.md section 4, except as decided in D-041.

export const SCHEMA_VERSION = 1

// migrations[n] takes a version n document to version n + 1 and must not mutate it. None yet.
export const MIGRATIONS = {}

export function migrate(doc, migrations = MIGRATIONS, target = SCHEMA_VERSION) {
  if (!Number.isInteger(doc.schemaVersion)) throw new Error('document has no schemaVersion')
  if (doc.schemaVersion > target) throw new Error(`document version ${doc.schemaVersion} is newer than this app (${target})`)
  let out = doc
  while (out.schemaVersion < target) {
    const from = out.schemaVersion, step = migrations[from]
    if (!step) throw new Error(`no migration from version ${from}`)
    out = step(out)
    if (out.schemaVersion !== from + 1) throw new Error(`migration from version ${from} did not advance to ${from + 1}`)
  }
  return out
}

const WRAP_MODES = ['none', 'box', 'shape', 'jump']     // D-035

// Throws on a document that breaks the model's rules. For loading and for tests; ops keep these rules themselves.
export function assertDoc(doc) {
  const needOrg = (record, what) => { if (!record.orgId) throw new Error(`${what} ${record.id} has no orgId`) }
  needOrg(doc, 'document')
  doc.stories.forEach(s => needOrg(s, 'story'))
  const placed = new Set()
  for (const page of doc.pages) {
    needOrg(page, 'page')
    for (const frame of page.frames) {
      needOrg(frame, 'frame')
      if (frame.storyId == null) continue
      if (placed.has(frame.storyId)) throw new Error(`story ${frame.storyId} is in more than one chain of frames`)
      placed.add(frame.storyId)
    }
    for (const object of page.objects) {
      needOrg(object, 'object')
      if (!WRAP_MODES.includes(object.wrap?.mode)) throw new Error(`object ${object.id} has unknown wrap mode ${object.wrap?.mode}`)
    }
  }
}
