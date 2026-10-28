# CLAUDE.md — project memory

Read `docs/PRODUCT_PROMPT.md` for the full brief. This file is the short version plus the decision log. Append to the log; never rewrite it.

## Project
Hindi page-layout Studio: build a printable newspaper / school magazine from the publisher's own stories, publish the same layout as an e-paper. First customer: Janshakti Ujala (Indore weekly). Working name "Studio" (not "Patrika").

## Before building
Run the plan review first: `docs/PLAN_ENHANCEMENT_PROMPT.md` (Claude Code plan mode, `opusplan`). Its approved output replaces the draft estimates in `docs/phases/`.

## Current phase
Phase 0 — engine spike. See `docs/phases/phase0-engine.md`.

## Commands
- `npm run harness` — run every active gate, print a table, exit 1 on failure
- `npm run harness -- --phase 0` — gates for one phase
- `npm run harness -- --list` — list all gates and status
- `npm run spike` — Phase 0 Pretext-vs-DOM parity run (writes `spike/out/report.md`)
- `npm test` — unit tests in `packages/*`
- `npm run ux` — UX/accessibility lint on the routes in `harness/ux/routes.json` (needs the app running; fixture mode works without it)

## Rules
1. Document is data; every change is an op with an inverse. Auto-pager and UI share ops.
2. Engine is pure, DOM-free, millimetres. One engine for preview, e-paper and export.
3. Fonts are bundled open-licence files; measure with the file you display.
4. Own content only. No scraped news. Record licence for every stock asset.
5. No silent AI. Changes are listed; user accepts or undoes.
6. Designs in `docs/design` are the spec. Gaps go to `docs/DESIGN_GAPS.md`.
7. Never state a number you did not run. Results live in `harness/results/`.
8. UX is binding: `docs/UX_SPEC.md`. One primary action per screen, plain Hindi, undo not confirm dialogs, mark UI with `data-ux` attributes, run `npm run ux` before every UI commit.
9. Phase gates are hard. Do not start phase N+1 until `--phase N` passes. Phase 2 also needs 3 paying weeklies.
<!-- testing-rules -->
10. Done means a command passes. Name the command before writing code. After every task run `npm test` and `npm run harness -- --phase N` and paste the real output. "Should work" is not a result.
11. Bug workflow: reproduce, write a failing test with the exact input, find the cause (log or bisect; do not guess), fix, run everything. Keep the test forever. Add the input to `harness/corpus` or `spike/samples`.
12. Never loosen a gate or test to get green: do not edit thresholds in `harness/gates.json`, skip or delete a test, or change an expected value without Amal's explicit approval. If a gate or test looks wrong, stop and show the evidence.
13. flow() contract and invariants (`docs/TESTING.md`): text conserved, lines inside frames, clear of obstacles, never wider than the box, reading order, deterministic. The engine stays DOM-free; Node tests use `packages/engine/test/helpers/fake-canvas.js`.
14. Every op has an inverse and must pass `fuzzUndo` (`packages/engine/test/helpers/fuzz.js`). Ops never mutate their input.
15. One small task per commit (about an hour of work), committed only when green. Never commit with a failing test.
16. Anything that changes print output (export, colour, fonts, bleed) is reviewed by a fresh session that did not write it, and gets a physical proof from the printer before a phase is called done.

## Decision log
| ID | Date | Decision | Why |
|---|---|---|---|
| D-001 | 2026-10-28 | Engine first, then auto-page, designer last | Value is operator-hours saved; a blank-canvas editor competes with Canva/Affinity and loses |
| D-002 | 2026-10-28 | Every editing op is also an auto-pager op | Prevents a UI that the machine cannot drive |
| D-003 | 2026-10-28 | Pretext is a candidate, not a commitment; Phase 0 parity gate decides | Early library, no Indic claims; Mukta missed ~10% of breaks in the first run |
| D-004 | 2026-10-28 | Export = engine lines drawn absolutely, Chromium PDF, Ghostscript CMYK/PDF-X | Chromium shapes Devanagari correctly; engine lines prevent re-breaking |
| D-005 | 2026-10-28 | Own content only | Janshakti dropped GNews and Patrika RSS for ToS reasons |
| D-006 | 2026-10-28 | Justify with word-space only | Letter-spacing breaks shirorekha |
| D-007 | 2026-10-28 | Product name is a placeholder constant | "Patrika" is Rajasthan Patrika's name |
| D-008 | 2026-10-28 | npm workspaces, TypeScript, Next.js 14, Supabase | Matches existing Janshakti stack |
| D-009 | 2026-10-28 | Match XLR8's convenience, not its sourcing: v1 content = own stories + own-site import + lead radar (headlines/links) + dedupe + source/licence on every story. Pool and agency feeds are a later paid add-on after 3/5 buyers say yes and an agency quote works. No scraping, no AI rewrite of others' copy | GNews terms (checked 2026-10-28) grant no republication licence and ban resale of API access; Janshakti already dropped GNews/Patrika RSS |

## Open questions
- Agency quotes (PTI, UNI, IANS, Hindusthan Samachar) and one hour with an Indian media/IP lawyer before any content add-on ships.
- Page sizes and grid for Janshakti's printer (ask printer for spec sheet: trim size, bleed, ink limit, ICC profile).
- Which body fonts pass the parity gate (Noto Sans / Noto Serif / Mukta)?
- Reuse the `janshakti-epaper` reader or build a new one?

- D-010 correction (2026-10-28): Mukta's earlier 88% parity was caused by Devanagari-only font files (digits and English fell back to system fonts). With Latin bundled it is about 99%. Tiro Devanagari Hindi (about 79%) and Vesper Libre (about 58%) fail for undiagnosed reasons and are not worth diagnosing now.
- D-011 (2026-10-28): v1 font set. Body: Noto Sans Devanagari, Noto Serif Devanagari. Headline: Khand, Eczar. Display: Rozha One. Handwritten (school magazines): Kalam. Reserve (passed, not in v1 UI): Halant, Martel, Sarala, Hind, Teko, Arya. Preview-only (99.2-99.4%): Mukta, Baloo 2, Yatra One. Server-layout only: Tiro Devanagari Hindi, Vesper Libre. A font enters the UI only if it passes docs/FONTS.md (at least 99.5% on real copy, clean halant checks, Latin bundled). Bold weights are untested: test them before any bold headline ships.
- Font and engine tuning is closed. Do not revisit fonts until a Phase 1 template needs one.
