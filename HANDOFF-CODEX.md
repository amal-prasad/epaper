# Handoff to Codex — 2026-11-07

From: Claude Code session on branch `phase1-templates-v2`. Workspace: `D:\epaper`.
The older `handoff.md` (2026-11-02, Codex to Claude Code) is history; this file supersedes it where they differ.

## Read first

1. `CLAUDE.md`: every rule applies to you too.
2. `docs/DECISIONS.md` D-076 to D-084: why we are building the app now and every ruling Amal made today.
3. `docs/design/ui-v2.md`: the UI spec. Its §0 holds Amal's rulings and overrides the rest of that file.
4. `docs/UX_SPEC.md`: it wins on accessibility.
5. `docs/GATE_GAPS.md` GG-081 to GG-085 and `docs/DESIGN_GAPS.md` G17 to G22: the open risks from today.

**Important for Codex:** the `.claude/hooks` (protect-gates, stop-check) do not run for you, so nothing stops you mechanically. The rules still hold:
- Never edit `harness/gates.json`, `harness/run*.mjs`, `harness/judges.mjs`, `harness/judges.lock.json`, `harness/test-ratchet.json`, `harness/tools/`, `harness/results/`, `.claude/` or the root `package.json` scripts.
- Never weaken a test or add skip/only.
- Changing a judge (that includes `harness/ux/routes.json`) makes `npm test` fail until Amal runs `npm run approve`. When that happens, stop and tell him what you changed and why.
- Never commit with a failing test. Never push; Amal pushes.
- Ask Amal multiple-choice questions, A/B/C in chat (D-072: Codex has no quiz tool), and log any answer that decides something in `docs/DECISIONS.md`.
- No Claude co-author lines in commits.

## Where things stand

- **Phase:** Amal overrode rule 9 and started Phase 3 app building (D-081). We are building the real product (D-082). Phases 1 and 2 still have open gates, and Phase 3 cannot be called done until `npm run harness -- --phase 1 --done` and `--phase 2 --done` pass. `CLAUDE.md` still says "Current phase: Phase 2"; only Amal can change that file.
- **Stack:** an npm workspace. `apps/studio` is Next.js 16.4.5 with React 19.3.1. The engine is plain JS and DOM-free in `packages/engine`; the new wording and queue package is `packages/ui`. The local store is `data/issues/<id>.json`. No Supabase or auth yet.
- **Tests:** `npm test` runs only `packages/*/test` and `harness/test`, so app logic that needs tests belongs in a package. The app itself is checked by `node scripts/smoke-studio.mjs`, which starts the app, opens `/issue/sample` in Chromium, and checks lines, console, primary button, percentages, axe, the check queue and undo/redo.
- **Last results (2026-11-07, local Windows):**
  - `npm test`: 469 passed, 0 failed.
  - `npm run harness -- --phase 2 --fast`: no gate fails; 5 pending.
  - `npm run ux`: no violations, but it lints the fixture page only.
  - Smoke check: SMOKE PASS.

## What was done today (commits on `phase1-templates-v2`)

| Commit | Work |
|---|---|
| 3a38b34 | UI v2 spec: `ui/` boards (v6 Home, v5 Editor), `docs/design/ui-v2.md`, D-079 to D-081, design gaps G17–G22, demo `demos/ui-v2-spec.html` |
| 440280e | T1: `packages/engine/src/marks.js`. `pageMarks(doc, pageId)` reports each slot as over, empty, ok or unfilled, with `overLines`/`emptyLines` and no percentages. `issueProblems(doc)` gives the "जाँच" queue. It reuses `measure()` from autopage.js, now exported |
| fba8c0f | T2: the `apps/studio` scaffold. `packages/engine/src/layout.js` `pageLayout(doc, pageId, {inks})` returns pure line boxes in px; the app draws them absolutely. Fonts are served from `spike/public` (rule 3). `scripts/sample-issue.mjs` builds `data/issues/sample.json` from the golden pages. Adds `scripts/smoke-studio.mjs` |
| 96949d3 | T3: marks in words with icons, the page strip, slot selection, and the single primary button "जाँच (N)" (also the N key). `packages/ui` holds `markWords`, `markTitle`, `nextProblem` and `pageStatus` |
| f8f3cce | T4: editor changes run on the engine history (`startHistory`/`run`/`undo`/`redo`). Undo and redo buttons with words, Ctrl Z/Y, an 8 s toast with "वापस लाएँ". The first change the UI can make is "स्लॉट खाली करें". Adds `describeOp` |
| 2d63adf | A font that fails to load is now fatal, as in export. Adds GG-083 to GG-085 |
| 2f64768 | D-084 |

Demos, each linked from `demos/index.html` (rebuild with `npm run demos`): `fit-marks.html`, `studio-editor.html`, `studio-marks.html`, `studio-undo.html`.

## Amal's rulings to follow

- **D-080:**
  - Send to press is gated by the check: the button reads "जाँच (N)" until there are no problems, then "प्रेस PDF बनाएँ". It ends on a calm screen with the real PDF and a proof link: no confetti, no "छप गया".
  - The boards win on look and wording; UX_SPEC wins on accessibility.
  - No percentages in the operator UI, only line counts and the visual result.
  - All four proposals are adopted: preview a fix on hover, trim review in place, a problem queue across pages, a thumbnail page strip.
- **D-083:** any empty line counts as empty (no threshold). Work in small tasks, but don't split by time estimates; test what you build and commit after each task.
- **D-084:**
  - Add a help button, then the `routes.json` change, which Amal approves.
  - Move `apps/studio` to **TypeScript**; the engine and packages stay JS.
  - The next slice is save plus help.

## Next steps, in order

Each task is test-first. End each one with `npm test`, `npm run harness -- --phase 2 --fast`, the smoke check, a demo page in `demos/` listed in `demos/tasks.json`, and a risk sweep into `docs/GATE_GAPS.md`. Then commit.

1. **Move `apps/studio` to TypeScript.**
   - Add `typescript`, `@types/react` and `@types/node` to the app, plus a `tsconfig.json`.
   - The engine is JS without types: either `allowJs` or a small `declare module` for `@studio/engine/src/*.js` and `@studio/ui`.
   - Rename the files to `.ts`/`.tsx`. `next build` must pass and the smoke check must stay SMOKE PASS.
2. **Save to the local store, with a save status (GG-084).**
   - Write the doc and op log after each op through a server route, atomically (temp file + rename; see `packages/production/src/store.js`).
   - Header status: "सहेज रहे हैं…" / "सहेजा गया ✓" / "सहेजा नहीं जा सका" with a retry.
   - Reopen at the saved version. Extend the smoke check: make a change, reload, and the change is still there.
3. **Help button** `data-ux="help"`: "मदद चाहिए?", in the same place on every screen (UX_SPEC §2.10). The WhatsApp number or target is unknown, so ask Amal.
4. **Lint the editor:** change `harness/ux/routes.json` (baseUrl `http://localhost:3210`, route `/issue/sample`, desktop viewport). That's a judge change: stop, show Amal the diff, and he runs `npm run approve`.
5. **Unplaced stories in the queue (GG-085).** Emptying a slot leaves an unplaced story, and export rejects that. Show unplaced stories in "जाँच", plus a "बिना जगह" list with a "यहाँ रखें" button (a drag alternative).
6. **Fix options**, ranked in the right panel as in ui-v2.md §3.5, with words and no percentages, and a ghost preview on hover:
   - swap two slots: a grouped op so one undo reverts both `placeStory` ops;
   - headline smaller: needs a new op with an inverse, passing `fuzzUndo`;
   - grow slot (`setObjectGeometry`, plus a disabled reason when it collides with something).

   Trim waits for G18, the review design and a text op.
7. **Later:** Home core (D-080 (5)); gating "प्रेस PDF बनाएँ" on export; the smoke check in CI (GG-083, needs Amal); the GG-082 line-count parity gate between editor and export.

## Gotchas

- Run the app with `npm run dev -w @studio/app` (port 3210). Don't add scripts to the root `package.json`; those scripts are judges.
- Every font must be loaded before calling `pageMarks`/`pageLayout`, or the line breaks come from a fallback font.
- `pageLayout` must keep the same defaults as `packages/export/src/render-browser.js`. Don't touch render-browser.js: it's on the print path and needs a reviewer under rule 16.
- Overlay text (marks, labels) is drawn outside the 0.62 page scale, so it stays at 14 px or more.
- `data/issues/sample.json` is generated; rebuild it with `node scripts/sample-issue.mjs`.
- Amal's uncommitted changes (`CLAUDE.md`, `harness/judges.lock.json`, `harness/test-ratchet.json`, `docs/phases/phase2-press-publish.md`, `docs/plans/2026-11-04-preflight.md`, `docs/design/studio-ds/`, `docs/design/studio-system/`) are his. Don't commit or delete them; studio-ds and studio-system are the rejected D-077 design.
