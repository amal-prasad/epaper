# Session handoff — 2026-11-02

## Latest continuation — three parallel Phase 1 workstreams

This section supersedes the older next-session recommendation below. Amal authorized three Sol agents for this step; the exception is recorded in D-069. The original uncommitted export work is preserved.

- `G2.pdfx` and `G2.proof` are now active and approved, with results recorded by Amal. A fresh Phase 1 harness run passes all four active gates; `G1.golden`, `G1.autoplaced` and `B.minutes.w8` remain pending.
- Golden preparation is implemented. `demos/golden-pages.html` links to ten current candidates in `demos/golden-pages-v2/`. All ten rendered identically twice; three real rendered mutations were rejected. Two denser fixtures contain 117 and 102 body lines. The older `demos/golden-pages/` is an unapproved authoring artifact. Read `docs/golden-pages.md`; do not label candidates accepted or auto-update a baseline.
- `packages/engine/src/autopage.js` proposes deterministic placements into empty unlocked slots through existing reversible ops. Existing placements and copy remain intact; oversized stories remain explicitly unplaced. Demo: `demos/autopage.html`. Read `docs/autopage.md` for boundaries, including no chains, resizing, furniture binding or automatic stale-proposal guard.
- `scripts/production-log.mjs` appends operator-entered measurements to `.local/production/` and summarizes the actual latest four issues. Synthetic records never qualify. Read `docs/production-log.md`: elapsed time is the conservative suggested gate basis; active work is reported separately. No human result was recorded by an agent.
- Fresh full test suite: 447 passed, 0 failed. Complete test and Phase 1 harness outputs are in `demos/phase1-verification-tests.txt` and `demos/phase1-verification-gates.txt`. Agent cross-reviews found no actionable blockers. New risks GG-077 through GG-079 cover golden scope, stale proposals and production evidence custody.

Next: have Amal review the ten candidates, then propose formal golden-runner integration through his gate approval process. Build operator acceptance/editing controls against the existing auto-page proposals with a source-version guard. Real issue trials must supply the placement/time evidence; nightly off-machine backup and second-machine recovery remain required before paid use. Do not start Phase 2.

## Start here

Read `CLAUDE.md` first and follow it throughout the session. Then read this handoff, the latest rows of `docs/DECISIONS.md` (D-064 through D-068), `docs/phases/phase1-autopage.md`, and `docs/RUNBOOK.md`. Run `graphify query "<your codebase question>"` before raw source exploration. The code graph was updated after the export changes.

Workspace: `D:\epaper`. Branch: `phase1-templates-v2`. HEAD when this handoff was written: `f49b66e` (`feat: complete section via claude`). The export work is **uncommitted**, with new/untracked source and demo files. Do not reset, clean, or discard them. No push was made. Preserve the user-approved changes in `harness/judges.lock.json`; do not edit protected lock/result files manually.

## User direction and working style

- The intended product serves many newspapers and presses across India. Janshakti is a pilot, not the product boundary.
- Proceed with reasonable, explicit, editable assumptions in this phase. Do not block all development on one printer's specifications. Use publication settings and reusable output profiles; refine production settings later.
- Ask necessary questions as short A/B/C quizzes **directly in chat**. The user cannot open the question-tool UI. This explicit preference overrides CLAUDE.md's tool-specific wording. Record decisions in the append-only decision log.
- The user chose A: reuse `scripts/black-spike.mjs` for the existing CMYK/Gray work. This has now been integrated; do not restart that discussion or rebuild the experiment.
- The user wants to perform and record PDF/X validation and physical-proof acceptance himself. He requested Bash commands for it. This request is **not evidence that either check has passed or that the commands have run**. Check the current metrics and gate status in the new session.
- Move on to other Phase 1 work. Do not declare Phase 1 complete or start Phase 2 while its required gates remain pending.
- No worktrees or parallel builders. Independent read-only print-output review is required by CLAUDE.md rule 16 and was performed for this export integration.

## Where the project stands

Phase 0 is complete. Its full gate check passed earlier in this conversation. Phase 1 has the document/ops/undo foundation, configurable presets, wrap modes/shaped obstacles, fit meters, twelve weekly layouts, headline ink fitting, and now an assembled development PDF export.

Latest implementation verification, from the preceding coding turn:

- `npm test`: **418 passed, 0 failed, 0 skipped**. Current saved report: `harness/results/tests.json`.
- `npm run harness -- --phase 1`: `G1.nodims` PASS, `G1.fitdrift` PASS; five pending gates listed below.
- Independent reviewer found and rechecked rendering, sampling and page-origin fixes; no important issue remained in the reviewed fixes.
- Two-page colour and mono demos opened in Chromium with zero console errors.
- Actual demo maximum ink: colour **226.67%**, mono **100%**, below provisional **240%**.
- The local export CLI succeeded on the synthetic A3 fixture.
- `npm run demos`, `graphify update .`, and `git diff --check` completed.

This handoff task did not rerun the full test suite. It read the saved report and checked the approval verifier: `ok: true`, with the colour/export/render files listed as new tests. A `newTests` list alone is not an approval failure. Recheck the actual verifier before asking for another approval. CI has not validated the current uncommitted work; do not describe old CI runs as proof of this working tree.

## Export implementation to preserve

Public package: `packages/export/src/index.js`.

| File | Responsibility |
|---|---|
| `settings.js` | Validated, serializable output settings; explicit assumptions; publication values override reusable defaults |
| `render.js`, `render-browser.js` | Existing engine flow and bundled fonts in Chromium; intermediate PDF, screenshots, neutral masks/regions |
| `pdf-tool.py` | Structured pikepdf rewrite/inspection and page-box normalization, including top-origin preservation |
| `pdf.js` | Strict Python/Ghostscript process calls; ICC discovery; colour/Gray conversion; provisional PDF/X-3 output metadata |
| `plates.js` | 192 dpi separations; ink-limit and per-region neutral coverage/tone checks; compact plate previews |
| `export.js` | Assembled checks and atomic publication into a fresh version directory; existing outputs are never overwritten |

Entry command:

```bash
node scripts/export-issue.mjs ISSUE.json --out NEW_DIRECTORY --profile presets/output/development-colour.json
```

Mono profile: `presets/output/development-mono.json`. Explicit document `exportProfile` fields override profile defaults; a document pinned to the colour route must be changed or left unresolved for a mono profile to apply.

Dependencies already installed locally: Node workspace/spike dependencies, Playwright Chromium, Ghostscript 10.04.0, and Python dependencies under ignored `.local/export-python/`. On another machine:

```bash
python -m pip install --target .local/export-python -r packages/export/requirements.txt
```

The requirements pin pikepdf and the qrcode library used for the synthetic fixture. `GS` and `PYTHON` environment variables can select executables. Do not replace bundled fonts with system fonts.

Review pages:

- `demos/index.html`: overall task/gate index.
- `demos/press-export.html`: screen versus actual intermediate PDF raster at two sizes.
- `demos/converted-export.html`: final colour/mono PDFs, reports and C/M/Y/K plates.
- `demos/converted-export/latest.json`: currently linked output bundle locations.

Regenerate fixtures before converted demos:

```bash
node scripts/demo-press-export.mjs
node scripts/demo-converted-export.mjs
npm run demos
```

All sample copy/artwork is synthetic. QR modules encode our own test payload and include a quiet zone. The supplied Dainik Bhaskar page was a composition reference; its content/assets were not reused.

## Important limits, not reasons to halt unrelated work

- Output is labelled checked development output. The exporter checks PDF/X-3:2002 target metadata, output-intent identity, fonts, page boxes, colour spaces and plates. **Independent PDF/X conformance certification is still separate.** PDF/X-1a is not implemented by this integration.
- Zero bleed, crop marks off, knockout black and the provisional profiles are supported. Other bleed/crop-mark settings, overprint, custom mono tint curves and unsupported vector colour/transparency constructs fail explicitly.
- Renderer refuses frame chains and rotations. Rich paragraph objects, paragraph formatting, automatic story/template furniture binding and mixed paragraph styles still need work.
- Neutral vector checks do not establish that lettering baked into colour artwork is K-only. Raster-only ad pages explicitly skip the neutral-vector subcheck while retaining ink/colour checks.
- Source JSON, report and the exact ICC are bundled, but externally referenced images and fonts still need the planned backup workflow. Second-machine recovery has not been performed.
- Risk rows GG-073 through GG-076 capture renderer coverage, intermediate/final boundaries, thin-defect sampling and page-origin normalization. Existing gate definitions were not changed by the implementation.

## Remaining Phase 1 gates

These were all pending when the last harness run completed. Re-read the live files because the user may now record/activate the last two himself.

| Gate | Required evidence / next work |
|---|---|
| `G1.golden` | Ten reviewable representative golden pages and a meaningful deterministic visual-regression check; no result exists yet |
| `G1.autoplaced` | Auto-page v0 plus real production measurements: at least 60% placed without manual moves, median of the last four produced issues |
| `B.minutes.w8` | User-recorded median at most 150 minutes per eight-page issue, last four produced issues |
| `G2.pdfx` | User's actual PDF/X validation result; target metadata alone is not this evidence |
| `G2.proof` | User confirms digital proof accepted and a real Janshakti issue printed cleanly from the exported PDF |

Both `G2.*` gates belong to **Phase 1**, despite their names. Never invent hand-measured metrics or run `npm run record` / `npm run approve` for the user. Recording a metric does not activate a pending gate. Only the user should change/approve gate definitions under the current process.

## Recommended next session

Start with **G1.golden preparation**: inspect the existing templates, demos and rendering pipeline, prepare ten deterministic representative page candidates and a baseline-review demo, then propose the visual comparison and negative controls. Keep candidate baselines reviewable; do not bless screenshots as correct merely because the program produced them. Gate changes or approved-judge changes need the user's own approval process. The current gate has only a pending metric definition; do not assume there is an implemented golden runner.

Then build auto-page v0 in small steps toward `G1.autoplaced`: deterministic placements, priority to slots, unchanged locked placements, change lists and reversible engine ops. Story continuations require explicit document/ops work plus exporter support: the current renderer rejects `nextFrameId`, and GG-059 records dangling-chain risk. Do not silently trim overflow to make placements succeed. Register any new ops with undo fuzzing.

After that: minimal operator controls and production trials, with local storage and off-machine backup ready before paid use. User production measurements are the evidence for placement/time gates; synthetic fixtures are not substitutes.

Keep PDF/X validation and physical-proof work available for the user without letting those external checks block golden-page or auto-page development. Do not reopen fonts, tie the product to one press, add Supabase/self-service/API work, or jump phases as a side quest.

Suggested new-session prompt:

> Read CLAUDE.md and handoff.md first. Preserve the current uncommitted export work. Check the live Phase 1 gate status and approval verifier, then begin G1.golden preparation with ten deterministic, reviewable representative pages. Use explicit working assumptions and reusable publication profiles. Ask necessary questions as A/B/C quizzes directly in chat. Do not change gates or record human results on my behalf.
