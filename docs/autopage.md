# Auto-page v0

`packages/engine/src/autopage.js` exports the pure, DOM-free `autopage` function. It proposes additive placements in an existing document. It does not edit story copy or apply the proposal to an editor history silently.

```js
import { autopage } from './packages/engine/src/autopage.js'
import { run, undo } from './packages/engine/src/ops.js'

const proposal = autopage({
  doc: history.doc,
  locks: ['page1-reserved-frame'],
  pageLocks: ['page4'],
  maxFitChecks: 2000,
})
// Show proposal.changes, proposal.unplaced and proposal.unresolvedOverflow first.
// On acceptance, against the same document version:
for (const op of proposal.ops) history = run(history, op)
// Undo each accepted operation with the existing history API:
for (const op of proposal.ops) history = undo(history)
```

The caller supplies the document, its stories, and built template frames. Optional `templates: {pageId: template}` builds slots through the existing `applyTemplate` op, only on entirely empty unlocked pages. A page containing either frames or objects is refused; applying a template never removes existing furniture. Objects created by templates can still need explicit text, assets and story headline binding. A placement proposal is not an export-readiness certificate.

`locks` contains frame IDs and `pageLocks` contains page IDs. Unknown IDs throw. Existing placements are preserved regardless of whether they are locked. `frame.locked` and `page.locked` also reserve their placements or empty slots. The function never resizes a frame, moves an existing story or changes an object.

Unplaced stories sort by ascending priority (1, 2, 3; default 2), then string ID using code-point comparison. Slots sort by priority, page number, page ID and frame ID. The first fitting eligible slot wins. Input array order, locale and wall-clock time do not break ties. This is a bounded greedy pass, not a global packing optimizer; a high-priority story may use a lower-priority slot when earlier slots cannot fit it.

The result contains:

| Field | Meaning |
| --- | --- |
| `doc` | Proposed document, with unchanged story data |
| `ops` | Existing `placeStory` / optional `applyTemplate` operations, in acceptance order |
| `inverses` | Existing inverse ops, in reverse application order, restoring the exact input |
| `changes` | One explicit change per operation, including story/frame/page IDs and fit where applicable |
| `placements` | Existing and new placements, with `existing`, `locked`, story/frame/page IDs and fit metrics |
| `unplaced` | Story IDs and `overflow`, `no-slot`, `budget-exhausted` or `empty-copy`; best checked slot when available |
| `unresolvedOverflow` | Overflow in preserved existing placements; it remains unresolved |
| `pages` | Per-page placement summaries |
| `fitChecks` | Candidate checks used, excluding the separate bounded checks of existing placements |

Fit uses `frameColumns`, `wrapObstacles`, `flow` and `fit` with the export renderer's current millimetre-to-pixel conversion, frame-specific obstacle filter and typography defaults: Noto Sans Devanagari, weight 400, 12 px, line height 18 px. Each `frame.style` overrides these defaults. Measurements require the same actual bundled fonts as rendering. Node fake-canvas tests check logic only. The Chromium demo compares fit counts against the existing actual renderer with bundled fonts. `overflowChars` also detects any remainder that the exporter would reject, including whitespace. A zero-capacity infinite `fillPct` becomes `null` so the proposal remains valid JSON.

Review and acceptance must use the document version that produced the proposal. This function supplies no concurrency or stale-history guard. Ops and inverses serialize as ordinary JSON; acceptance and undo use the existing history path. It does not create a new op type.

Work bounds are explicit: at most 256 stories, 64 pages, 256 frames, 4,096 existing objects, 256 points per existing polygon, 20,000 UTF-16 units of joined copy per story, 64 text columns per frame, and 10,000 line slots per measured frame. Templates have at most 1,000 grid rows and 256 slots. The default candidate budget is 2,000; callers can choose 1–10,000. Exhausting it leaves remaining stories unplaced. The function rejects invalid IDs, priorities, columns, frame geometry, rich paragraph bodies and continuation chains.

Full continuation support is deferred. The exporter currently refuses `nextFrameId`; v0 therefore makes no chains or jump lines. Rotated frames and objects are also refused because export does not support them. Column trimming, photo resizing, headline/furniture binding, paragraph styles, automatic page creation and global backtracking are also deferred. Copy is never shortened to claim a fit. Existing overflow stays reported, and a new oversized story stays unplaced for the operator.

Validation commands are `node --test packages/engine/test/autopage.test.js` and `node scripts/demo-autopage.mjs`. The latter writes the self-contained review page `demos/autopage.html`, before/after images, input and proposal reports. Its synthetic content is owned test copy. It is not evidence for either production gate. G1.autoplaced still requires the operator's real placement measurements from the last four produced issues, with median at least 60%; the time gate still requires independently recorded real production minutes.
