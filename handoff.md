# Claude Code handoff — 2026-11-02

## Update 2026-11-03 (D-072) — supersedes the conflicting lines below

- **Questions:** in Claude Code, use the AskUserQuestion quiz tool (CLAUDE.md rule 18). "A/B/C directly in chat" was a Codex-only workaround.
- **Pushed:** Amal pushed `phase1-templates-v2`. CI run 41683897058 on da65e93 is **red**: `npm test` step, 419 passed and 8 failed. Export tests (`colour`, `export`, `golden`, `render`) stop after one test on CI. The cause is unconfirmed, tracked as GG-080. Likely CI lacks Chromium (installed only after `npm test`), Ghostscript and pikepdf.
- **Golden:** Amal reviewed all ten v2 candidates and reports them correct. Reviewed baseline is at `harness/golden/baseline-2026-11-03/` (D-073); a fresh render matches it with 0 changed pixels on all ten pages. Still to do: G1.golden runner, Amal's gate approval. The baseline is Windows-only, so CI needs its own reviewed Linux baseline.
- **Timing (GG-079):** resolved. Keep both: elapsed copy-to-press is suggested for B.minutes.w8, and active founder minutes are reported separately.
- **Leftovers:** spike timing churn discarded; `debug.log` is gitignored.
- Amal reports `npm test` and the Phase 1 harness passed locally.

## Read first

Read CLAUDE.md, this handoff, docs/DECISIONS.md D-064 through D-071, docs/phases/phase1-autopage.md and docs/RUNBOOK.md. The approved PLAN_REVIEW.md overrides the older product prompt. Use graphify query before raw code exploration; the graph was refreshed after implementation.

Workspace: D:\epaper. Branch: phase1-templates-v2. Previous Claude Code checkpoint: f49b66e (feat: complete section via claude). All implementation below is committed locally through b36e897; a documentation-only handoff commit follows. **Nothing was pushed.** Old CI success does not validate these commits.

## Commits after the Claude Code checkpoint

| Commit | Work |
|---|---|
| 76ee7c0 | Checked colour/mono export package, settings/profiles, CLI, tests, demos, approved judge lock and Amal's PDF/X/proof records |
| bb430f0 | Deterministic reversible auto-page proposals, tests and before/after demo |
| 3b33900 | Ten golden candidates, comparison tools, provenance and negative controls |
| 451ad72 | Local production ledger, atomic append CLI, last-four summaries and tests |
| 87afd5d | Shared demo index, runbook, decisions, risk log, handoff and verification evidence |
| b36e897 | Required packages/export/test/pdf-fixture.py test helper |

Before this documentation edit, remaining uncommitted files were:

- spike/out/report.json and spike/out/report.md: incidental measured timing change from 0.322 to 0.544 ms/frame, deliberately left uncommitted.
- debug.log: untracked Chromium GPU diagnostics, deliberately left uncommitted.

Preserve these unless Amal asks otherwise. No reset, clean, worktree, merge or push was performed.

## User direction

- Product serves many newspapers and presses across India; Janshakti is a pilot, not the product boundary. Use explicit editable assumptions and reusable publication profiles.
- Necessary questions must be short A/B/C quizzes **directly in chat**; Amal cannot open the question-tool UI. Append decisions; never rewrite the decision log.
- Reuse of scripts/black-spike.mjs was chosen by Amal and is integrated. Do not rebuild that experiment or reopen font selection.
- Amal authorized three Sol agents in parallel **for this step only** (D-069). They implemented separate files and cross-reviewed one another. This does not establish standing permission for future parallel builders; otherwise follow the normal single-builder rule. No worktrees.
- Amal authorized local commits and explicitly said **do not push**.
- Never run npm run approve or npm run record for Amal. Preserve approved locks and human evidence. A chat answer does not replace the repository approval process.

## Phase and verification

Stay in **Phase 1**. Phase 0 was completed earlier.

| Gate | Latest executed status | Evidence or remaining work |
|---|---|---|
| G1.nodims | PASS | 0 hardcoded engine dimensions |
| G1.fitdrift | PASS | 0% measured drift |
| G2.pdfx | PASS | Amal recorded errors=0 and activated/approved the gate |
| G2.proof | PASS | Amal recorded accepted=1 and activated/approved the gate |
| G1.golden | PENDING | Candidates/comparator exist; human baseline review and formal gate integration remain |
| G1.autoplaced | PENDING | Additive v0 exists; needs >=60% without manual moves, median of latest four real produced issues |
| B.minutes.w8 | PENDING | Ledger exists; needs <=150 minutes per eight-page issue, median of latest four real produced issues |

The G2 gates belong to Phase 1. Their records name Amal, date 2026-11-02, build f49b66e+dirty, and empty notes. They are user-recorded evidence, not independent validation newly performed by the agent or certificates for every future PDF. Do not rewrite their provenance.

Before committing, npm test freshly passed **447 tests, 0 failures**; saved report also has 0 skipped. Phase 1 harness passed all four active gates and explicitly reported three pending. Its zero exit without --done does **not** mean Phase 1 is complete.

Complete captured output:
- demos/phase1-verification-tests.txt
- demos/phase1-verification-gates.txt

At this handoff the saved report was inspected and judge verification rerun: **ok: true**, no problems. Five new test files appear under newTests; that alone is not an approval failure. Recheck verify() before asking for another approval.

Three new demos and their index links loaded in Chromium with decoded images and zero console/page errors. Cross-reviews found no actionable blockers. npm run demos, git diff --check and graphify update . completed. Graph refresh needed an authorized elevated retry because the sandbox could not read the user's Git ignore configuration. No full-suite rerun was needed solely for this documentation handoff.

## Visuals and docs

Open demos/index.html; the newest entries lead to:

| Work | Visual | Documentation |
|---|---|---|
| Golden pages | demos/golden-pages.html | docs/golden-pages.md |
| Auto-page | demos/autopage.html | docs/autopage.md |
| Production log | demos/production-log.html | docs/production-log.md |
| Intermediate export | demos/press-export.html | docs/RUNBOOK.md |
| Final colour/mono PDF and plates | demos/converted-export.html | docs/RUNBOOK.md |

Plans: docs/plans/2026-11-02-press-export.md and docs/plans/2026-11-02-phase1-gate-preparation.md. Decisions D-064–D-070 explain the implementation; D-071 records this commit/handoff checkpoint.

## Export implementation

Public API: packages/export/src/index.js.

- settings.js resolves validated serializable publication/output settings.
- render.js and render-browser.js draw existing engine lines with bundled fonts in Chromium.
- pdf-tool.py uses structured pikepdf operations and preserves top-origin positions when normalizing page boxes.
- pdf.js runs strict Python/Ghostscript conversion using the established black-spike neutral-to-K and Gray routes.
- plates.js performs 192 dpi ink and per-region neutral coverage/tone checks.
- export.js publishes checked bundles atomically into a new directory, refusing existing destinations.

Command: node scripts/export-issue.mjs ISSUE.json --out NEW_DIRECTORY --profile presets/output/development-colour.json

Mono profile: presets/output/development-mono.json. Explicit document exportProfile fields override profile defaults, including route. Existing local tools: Node workspace/spike dependencies, Playwright Chromium, Ghostscript 10.04.0, Python dependencies under ignored .local/export-python/. Install Python dependencies elsewhere with:
python -m pip install --target .local/export-python -r packages/export/requirements.txt

GS and PYTHON select executables. Never substitute system fonts. Regenerate demos in order: node scripts/demo-press-export.mjs, node scripts/demo-converted-export.mjs, npm run demos. demos/converted-export/latest.json identifies current bundles.

Output is labelled checked development output. Provisional target is PDF/X-3:2002, not PDF/X-1a; target metadata/output-intent checks do not certify independent conformance. Supported assumptions: zero bleed, crop marks off, knockout black. Unsupported bleed/marks, overprint, custom mono curves and vector colour/transparency constructs fail explicitly.

Renderer refuses chains and rotations. Rich paragraphs, mixed styles and automatic furniture/headline binding remain unsupported. Earlier export checks measured maximum ink 226.67% colour and 100% mono against provisional 240%. Neutral-vector checks do not establish that lettering baked into artwork is K-only; raster-only ads explicitly skip that subcheck while retaining colour/ink checks.

Bundles contain source JSON, report and exact ICC; external source images/fonts still need backup. Second-machine recovery has not been performed. Demo content/artwork is synthetic and owned; reference newspaper content was not copied.

## Golden-page preparation

Current gallery uses **demos/golden-pages-v2/**: ten image/PDF/source-JSON candidates plus manifest.json. demos/golden-pages/ is the earlier sparse unapproved authoring version, retained in Git. **Neither is an accepted baseline.**

Scripts: golden-pages.mjs generates into a fresh directory; golden-compare.mjs compares against a separate reviewed manifest; demo-golden-pages.mjs builds/checks the gallery. golden-density.mjs is a read-only authoring aid. Tests: packages/export/test/golden.test.js.

Ten templates cover front/inner/back layouts, shapes, ads, two page sizes and Sans/Serif body. After root visual review, inner/back candidates were made denser: 117/102 body lines, some within one line of frame bottoms. Synthetic copy counts are frozen; generation does not trim user copy.

All ten rendered identically twice. Actual shortened-headline, moved-frame and changed-font defects were rejected. Exact decoded RGBA comparison catches even a single changed pixel. Hashes pin fixture/image assets; provenance pins fonts/tools/environment. Missing/unreviewed baselines fail. Renderer source hashes are informational so code regressions can reach pixel comparison.

Commands:
- node scripts/golden-pages.mjs demos/golden-pages-NEW
- node scripts/demo-golden-pages.mjs demos/golden-pages-NEW
- node scripts/golden-compare.mjs CANDIDATE/manifest.json REVIEWED_BASELINE/manifest.json DIFF_DIRECTORY

Read the human review/custody workflow in docs/golden-pages.md. Do not overwrite reviewed assets or manufacture acceptance metadata. Screen goldens are intermediate RGB at 96 dpi; final PDF raster/CMYK defects require separate coverage. G1.golden still has no integrated runner/result; propose integration through Amal's approval process after visual review.

## Auto-page v0

packages/engine/src/autopage.js exports autopage({doc, locks, pageLocks, templates, maxFitChecks}). Returns proposed document, ops/inverses, changes, placements, unplaced stories, existing unresolved overflow, per-page summaries and fit-check count.

Uses existing placeStory and optional applyTemplate operations, no new op type. Priorities/stable IDs choose fitting empty unlocked slots. Existing placements, frame/page locks and source copy remain unchanged. Templates apply only to entirely empty unlocked pages. Unsupported chains, malformed inputs and bounded-resource violations fail explicitly. Oversized or empty copy remains unplaced.

The 11 tests include 80 seeded undo-fuzz runs. Browser demo shows two new placements, one unplaced overflow and three fit/render line-count matches using bundled fonts.

This is an additive greedy foundation, not the complete Phase 1 auto-pager: no continuation chains/jump lines, resizing, furniture binding, global backtracking or automatic new pages. Renderer validation remains stricter than fit. **Accept against the same document version:** an automatic stale-proposal guard is not implemented. Do not add an operator UI that silently applies stale ops.

## Production measurements

packages/production/src/ contains validation/aggregation and atomic file append with an exclusive lock, temporary file and rename. Tests cover ledger/store/CLI. No new runtime dependencies.

Commands:
- node scripts/production-log.mjs append MY_REAL_ISSUE.json
- node scripts/production-log.mjs summary
- node scripts/production-log.mjs summary --json

Default ledger: .local/production/real-issues.json. CLI destinations stay under .local/production/. Records explicitly identify real/synthetic kind, actual timestamps, dimensions/page count, publication/paid state, measured steps and complete story roster/manual moves. Synthetic ledgers never qualify.

Select the latest four real produced issues **before** eligibility checks; include unpaid issues and Janshakti. Never cherry-pick older eight-page issues. Time evidence requires all four to have eight pages. Placement denominators retain manual/unplaced intended stories. Summaries suggest user commands only; they never write harness metrics.

Timing ambiguity remains: gate says founder minutes; approved plan says copy-received-to-press-sent. Conservatively suggest elapsed time including waiting, report active work separately, and do not silently substitute a smaller value or change the gate. These are operator assertions, not authenticated observations. Windows can prohibit symlink testing; documentation explicitly states that capability limitation. This utility is not a backup/recovery system.

## Risks and next steps

Read GG-073–GG-079. New risks: GG-077 screen-golden scope/baseline review, GG-078 stale proposal acceptance, GG-079 production evidence completeness/timing/custody. GG-059 still covers dangling continuation chains. Preserve earlier renderer fixes for labels, overlays, ink bounds, thin-defect sampling and page-origin normalization.

1. Have Amal review all ten golden candidates. Correct findings, preserve separate reviewed baseline custody, then propose formal golden-runner/gate integration with negative controls. Do not activate gates yourself.
2. Build minimal operator acceptance/editing controls around the existing API, starting with a source-version guard and undo. Follow existing designs; do not rebuild completed preparation tools.
3. Run real issue trials and log all work. Only Amal records metrics. Continuations need coordinated document/ops/export changes before shipping; never trim copy silently.
4. Complete off-machine backup and test second-machine recovery before paid use. Include issue JSON, ops, assets, fonts, profiles, production ledger/notes and reviewed baselines.

Do not reopen fonts, tie the product to one press, add Supabase/auth/self-service/API scope or jump to Phase 2. Source changes need appropriate tests, Phase 1 harness, risk sweep, browser-reviewable demo and graph refresh. Independent print-output review remains required.

## Suggested Claude Code prompt

Read CLAUDE.md and handoff.md. Continue from the committed Phase 1 work after f49b66e; do not rebuild export, golden preparation, additive auto-page or the production ledger. Check live judge/gate status, preserve remaining timing reports/debug.log, and review demos/golden-pages.html with me before integrating G1.golden. Progress independent operator controls with stale-proposal protection as appropriate. Ask necessary A/B/C questions directly in chat. Never record human results, approve judges or push on my behalf.
