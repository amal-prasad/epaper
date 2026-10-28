# Phase 1 — Operator tool and first produced issues

Read `CLAUDE.md`, `docs/PRODUCT_PROMPT.md` and `docs/PLAN_REVIEW.md` first (the plan review overrides the product prompt on order, scope and gates). Phase 0 must pass first. No LLM in this phase. Weeks 3–8, about 135 h including about 35 h of issue production.

## Goal

Amal produces real issues with the tool (Janshakti weekly first, then pilot customers), sending a press PDF the printer accepts. Founder minutes per produced 8-page issue (B.minutes) fall to <= 150 (median of the last 4 produced issues, Janshakti included) by the end of week 8.

This phase builds an operator tool, not a self-serve product. Self-serve work is in `phase3-selfserve.md`.

## Order

1. **Document model + ops + undo first.** `packages/engine`: types from the product prompt, `schemaVersion`, `apply(doc, op)` with inverse, op log, undo/redo, migrations. Every op passes `fuzzUndo`; ops never mutate input; keep `org_id` on every record. Everything below writes ops.
2. After step 1, **the three slowest steps from experiment E5 set the order** of the rest.

## Tasks (drawn on after the document model, in E5 order)

- **Kruti Dev / Chanakya to Unicode** on paste with preview and undo; tested on real copy.
- **Templates:** three weekly templates as JSON (front page lead + secondary, inner news page, ads/greetings page), each with the PRGI imprint block (printer, place of printing, editor, publisher, place of publication; see the Press and Registration of Periodicals Act, 2023, s.3). No template editor.
- **Fit meters:** `fit(story, frame)` returns fill %, overflow lines, underfill lines; must equal what the renderer draws (G1.fitdrift).
- **Auto-page v0:** `autopage({ stories, template, locks })` returns one layout per page plus a list of changes the editor can accept or undo; deterministic; locked placements never move; every action is an op. Priority to slots; fit by trimming columns or photo size before overflow; overflow creates a jump line.
- **Minimal Guided toolbar for the operator:** move block to another column, resize, swap photo, send overflow to the next page. Keyboard equivalents. Not the full Guided design.
- **Press PDF export, run locally:** engine lines drawn absolutely, Chromium PDF, Ghostscript route chosen by experiment E2 (K-only black text), crop marks and bleed from the printer's spec sheet. An export-time script measures every rendered line's DOM width against its frame and fails the export on any overflow.
- **Page images and a simple e-paper reader:** reuse the `janshakti-epaper` reader if its article-map shape fits, otherwise static pages.
- **Proof link:** read-only page images on public static hosting, tap to comment, approve. Built to `docs/UX_SPEC.md` (this is the only screen a customer touches): plain Hindi, one primary action, `data-ux` marks.
- **Local storage, hosting and backup:** issue JSON, op logs and assets on local disk; static hosting for proof and e-paper (Cloudflare Pages/R2 or the Janshakti stack; decision pending); nightly off-machine backup; `docs/RUNBOOK.md` for exporting an issue from a second machine, tested once before the first paid issue.
- **Issue production:** each produced issue logs minutes per step, paid or unpaid, and stories placed without a manual move. Amal records B.minutes and G1.autoplaced with `npm run record`.
- **Bug workflow:** the "Report a problem" bundle and `npm run replay` stay (export `{ document, opLog, appVersion, fontsVersion }`), but build them only if a customer issue needs them.

## Gates

Active in this phase: G1.fitdrift (<= 2%), G1.golden (10 pages), G1.autoplaced (>= 60% of stories placed with no manual move, median of last 4 produced issues), B.minutes (<= 150 by end of week 8), G2.pdfx and G2.proof (moved here from phase 2: valid press PDF, printer accepts a real proof).

## Cut-line

Drop the e-paper reader first (send page images), then the proof link (send the PDF on WhatsApp). Never drop press export or backup.

## Out of scope (moved to `phase3-selfserve.md` or deferred)

`packages/ui` beyond five components (Button, Toolbar, Toast with undo, Callout, PageThumb), auth and roles, Supabase, dedupe, lead radar, usability rounds (SUS), a11y audits on the editor, phone mode, WhatsApp Business API, billing, backgrounds upload, the 20-issue replay corpus.

## Done when

`npm run harness -- --phase 1` passes, B.minutes <= 150 is recorded, and at least one produced issue has been printed from a PDF this tool exported.
