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
- `npm run harness -- --phase 0 --fast` — same, skipping slow gates (the parity run); use inside the build loop
- `npm run harness -- --phase 0 --done` — phase exit check: pending or skipped gates count as failures
- `npm run approve` — Amal only, in his own terminal: review and approve changes to gates, tests, scorer or rules
- `npm run record -- G1.time minutes=52 --by Amal` — Amal only: record a hand-measured gate result
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
12. Never loosen a gate or test to get green: do not lower thresholds in `harness/gates.json`, skip or delete a test, or change an expected value. If a gate or test looks wrong, stop and show Amal the evidence. Any change to a judge (gates, tests, test helpers, spike scorer, npm scripts, these rules) fails `npm test` until Amal reads the diff and runs `npm run approve`; when that happens, stop and tell him what you changed and why. Never try to get around a hook or the judges lock.
13. flow() contract and invariants (`docs/TESTING.md`): text conserved, lines inside frames, clear of obstacles, never wider than the box, reading order, deterministic. The engine stays DOM-free; Node tests use `packages/engine/test/helpers/fake-canvas.js`.
14. Every op has an inverse and must pass `fuzzUndo` (`packages/engine/test/helpers/fuzz.js`). Ops never mutate their input.
15. One small task per commit (about an hour of work), committed only when green. Never commit with a failing test. Never push; Amal pushes.
16. Anything that changes print output (export, colour, fonts, bleed) is reviewed by the `reviewer` agent (a fresh session that did not write it), and gets a physical proof from the printer before a phase is called done.

<!-- claude-code-harness -->
## Claude Code harness (in `.claude/` and `harness/`)
- `/task <what>` builds one small task with the test-first loop. `/bug <symptom>` fixes a bug test-first. `/gate` reports the current phase gates. `/review` asks the `reviewer` agent for a cold review of the diff.
- Hook `protect-gates.mjs`: blocks edits to `.claude/`, the harness runners, `harness/results/`, the judges lock and ratchet, and changes to existing tests (new tests and purely additive edits are allowed).
- `harness/judges.mjs`: every judge is fingerprinted in `harness/judges.lock.json`. Changing one (including `gates.json`, flipping a gate to active, or the spike scorer) is allowed, but `npm test` and the harness fail until Amal approves with `npm run approve`. Loosened gates are named in the approval.
- `harness/test-ratchet.json`: a test file may never lose tests or gain skips.
- Hand-measured results are recorded only by Amal: `npm run record -- <gate> <key>=<n> --by <name>`.
- Hook `stop-check.mjs`: Claude cannot finish while `npm test` fails (two attempts, then it must explain).
- If a hook or the lock blocks you, do not look for a workaround. Tell Amal what you wanted to change and why.

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
| D-010 | 2026-10-28 | Bundle Devanagari + Latin subsets of every font; launch body fonts Noto Sans and Noto Serif Devanagari; Pretext stays the candidate live engine | Devanagari-only subsets made digits and English fall back to system fonts that canvas and DOM measure differently; with Latin bundled the launch fonts reach 99.6% (docs/FONTS.md). Row reconstructed 2026-10-28 from docs/FONTS.md and phase0-engine.md, which cite it; correct it if the original said otherwise |
| D-011 | 2026-10-28 | Harness hardening: G0.flow is active and counts the 12 conservation contract tests plus 5 own flow tests (>= 17, none skipped); G0.parity also needs >= 40 real paragraphs and no invented samples; new flow invariants (no overlapping lines, no premature overflow); every judge is fingerprinted in harness/judges.lock.json and changes wait for `npm run approve`; hand results need `npm run record` | A do-nothing flow() passed all conservation tests; G0.flow could never pass as defined and phase docs told Claude to edit a file the hook blocks; the parity gate could pass on invented text; hand results and the spike scorer could be changed without anyone noticing |

## Open questions
- Agency quotes (PTI, UNI, IANS, Hindusthan Samachar) and one hour with an Indian media/IP lawyer before any content add-on ships.
- Page sizes and grid for Janshakti's printer (ask printer for spec sheet: trim size, bleed, ink limit, ICC profile).
- Which body fonts pass the parity gate (Noto Sans / Noto Serif / Mukta)?
- Reuse the `janshakti-epaper` reader or build a new one?

- D-010 correction (2026-10-28): Mukta's earlier 88% parity was caused by Devanagari-only font files (digits and English fell back to system fonts). With Latin bundled it is about 99%. Tiro Devanagari Hindi (about 79%) and Vesper Libre (about 58%) fail for undiagnosed reasons and are not worth diagnosing now.
- D-011 (2026-10-28): v1 font set. Body: Noto Sans Devanagari, Noto Serif Devanagari. Headline: Khand, Eczar. Display: Rozha One. Handwritten (school magazines): Kalam. Reserve (passed, not in v1 UI): Halant, Martel, Sarala, Hind, Teko, Arya. Preview-only (99.2-99.4%): Mukta, Baloo 2, Yatra One. Server-layout only: Tiro Devanagari Hindi, Vesper Libre. A font enters the UI only if it passes docs/FONTS.md (at least 99.5% on real copy, clean halant checks, Latin bundled). Bold weights are untested: test them before any bold headline ships.
- Font and engine tuning is closed. Do not revisit fonts until a Phase 1 template needs one.
