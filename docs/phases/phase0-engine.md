# Phase 0 — Layout engine spike (Hindi page-layout app)

Read `CLAUDE.md` and `docs/PRODUCT_PROMPT.md` first. The spike harness is already in `spike/` and was run once; extend it, do not rewrite it.

---

## Role

You are building the **layout engine core** for a Hindi newspaper / magazine page-layout web app (Janshakti Ujala e-paper is the first customer). Phase 0 is an engine spike with a hard go/no-go gate. Do not build any UI, auth, database, or AI features.

## Why this exists

The product's value is text flowing around photos, boxes and shapes, across multiple columns and frames, in Devanagari, with output that matches what prints. Everything else (templates, auto-fill, designer UI) sits on top of the engine. If the engine's line breaks differ from the browser's, the editor lies to the user.

Candidate: `@chenglou/pretext` (MIT, DOM-free text measurement + line breaking via canvas `measureText` and `Intl.Segmenter`; `layoutNextLine(prepared, maxWidth, cursor)` allows a different width per line). It is early-stage and says nothing about Indic scripts. We must measure, not assume.

## Baseline already measured

- Invented text (10 paragraphs): 97.4% match. Superseded.
- **Real Janshakti copy (121 paragraphs, 2026-10-28):** 96.2% overall with the first bundled fonts. Noto Sans / Noto Serif Devanagari 99.7% combined; Mukta 89%.
- **Root cause of the Mukta miss (found 2026-10-28):** the bundled woff2 files were Devanagari-only subsets, so digits, `.`, `‘’`, `—` and English words fell back to a system font. Canvas and DOM resolve that fallback differently. With the Latin subset bundled (`spike/add-fonts.mjs`), Mukta rises to about 99% and the launch fonts to 99.6%. Task 3 is therefore mostly done; what remains is the residual Mukta/Baloo 2 gap and why Tiro Devanagari Hindi (~79%) and Vesper Libre fail.
- Halant / conjunct / nukta / ZWJ-ZWNJ words: canvas and DOM widths agree on every tested word in every font; break parity 99.6-100%. All three launch candidates contain U+094D, U+200C/D, U+093C, U+25CC.
- Re-layout around a moving obstacle: 0.2-0.6 ms per frame for ~760 lines. Speed is a non-issue.
- Decision recorded as D-010 in CLAUDE.md. Per-font results: `docs/FONTS.md`.

## Tasks (in order)

1. **Run the harness** (`cd spike && npm install && npx playwright install chromium && npm run spike`). Confirm you reproduce the baseline.
2. **Real data.** Put 40+ real paragraphs of Janshakti copy into `spike/samples/*.txt` (blank line between paragraphs). Include conjunct-heavy words (क्ष, त्र, ज्ञ, श्र, द्ध, ट्ट), numerals, quotes ("" ‘’), em dashes, English words mixed into Hindi, and very long unbreakable tokens (URLs, names). Re-run.
3. **Finish the diagnosis (Mukta, Baloo 2, Tiro, Vesper Libre).** The Latin-fallback cause is already found (see Baseline); what is left is the residual gap. Find out why Pretext measures wider than the DOM. Check, in order: (a) kerning / GPOS shaping applied to whole text runs in DOM but per-segment in canvas; (b) `font-kerning`, `font-feature-settings`, `text-rendering` differences between canvas and DOM; (c) space width handling at segment edges; (d) conjunct / ZWJ / ZWNJ segmentation by `Intl.Segmenter`. Write the finding in `spike/out/diagnosis.md`. Try fixes such as `ctx.fontKerning = 'normal'`, `ctx.textRendering = 'optimizeLegibility'`, or measuring with the same CSS the DOM paragraph uses. Keep a fix only if it raises the match rate without lowering any other font's.
4. **More cases.** Add to `run.mjs`: font sizes 9, 10, 11, 13 px; weights 400 and 700; `text-align: justify` (line breaks must not change; confirm); column widths down to 70 px; obstacles on the right side and in the middle of a column (two-sided wrap = two width intervals per line, take the larger gap or split the line, document which); obstacle taller than the column; text that does not fit one word beside the obstacle (CSS pushes the line below the float; find out what Pretext does).
5. **Multi-column threading.** Write `packages/engine/src/flow.js` exporting `flow(story, frames, obstacles, { font, lineHeight })`. `frames` = ordered `[{id, x, y, w, h}]`, `obstacles` = `[{x, y, w, h, margin}]`. It returns `{ lines: [{frameId, x, y, w, text}], remainder: string }`, where `remainder` is the part of the story that did not fit (empty when everything fits). Use Pretext's `layoutNextLine` with the per-line width computed from obstacles (when an obstacle splits a line into two gaps, take the larger gap and document it). The test suite already exists: `packages/engine/test/conservation.test.js` is skipped until `flow.js` exists, then it checks text conservation, frame containment, obstacle clearance, line width, reading order and determinism on real Hindi copy plus 300 random fuzz cases (see `docs/TESTING.md`). It must pass without editing it. Also write at least 5 unit tests of your own in `packages/engine/test/flow.*.test.js` for the cases below (these feed gate G0.flow): two-column story, photo spanning both columns, photo in the middle of one column, overflow into a third frame, empty frame.
6. **Visual check.** Add `spike/public/flow.html` that renders `flow.js` output for one realistic page (4 columns, a photo, a boxed quote) with absolutely positioned line spans, next to the same text in plain CSS columns for eyeballing. Take a Playwright screenshot to `out/flow.png`. Do not polish.
7. **Server-side parity probe (only if match < 99.5%).** Prove or kill the fallback: lay out the same paragraphs with `harfbuzzjs` + a Devanagari font in Node, break lines with `Intl.Segmenter` + the same rules, and compare with the DOM. Report the match rate. Do not build a production pipeline.

## Constraints

- Plain JS (ESM), Node 20+, no framework, no TypeScript build step. Keep the engine DOM-free so it can run in a Web Worker and in Node.
- Fonts used for measurement must be the exact files used for display. Bundle them; never `system-ui` or `sans-serif`.
- Set `lang="hi"` on the page and call `setLocale('hi')` before preparing text. Re-prepare text after any font load or locale change.
- Do not modify `node_modules`. If Pretext needs a patch, document it and propose it upstream; do not fork silently.
- Do not claim a number you did not run. Every claim in the final report must come from `out/report.json` or a test you can point to.

## Gate (decide, do not hedge)

| Overall match on real Janshakti copy, all body fonts we would ship | Decision |
|---|---|
| >= 99.5% | **GO.** Pretext is the live engine. |
| 95% to 99.5% | **GO with caveat.** Pretext for live editing preview only; final PDF and e-paper map come from server layout (task 7). Measure the preview-vs-final drift and report it. |
| < 95% | **NO-GO.** Say so. Recommend the HarfBuzz-first alternative and what it costs. |

Also report: any font that fails on its own (we can simply not ship that font), and the worst failure you saw, with the exact two lines (DOM vs Pretext).

## Deliverables

- `spike/out/report.md` and `report.json` from the real-data run.
- `spike/out/diagnosis.md` for the Mukta miss.
- `packages/engine/src/flow.js` + tests in `packages/engine/test/`, passing (`npm test`).
- `spike/out/flow.png`.
- `docs/PHASE0_DECISION.md`: the gate decision, the numbers, the worst failures, the fonts approved for body text, the list of things Pretext does not do that we must build (selection, cursors, rich text, threading UI, hyphenation policy, widow/orphan control), and an estimate in working days for Phase 1 (templates + auto-fill) given what you learned.

Keep `docs/PHASE0_DECISION.md` under one page. Blunt. No marketing language.

## Out of scope for Phase 0

UI, drag-and-drop, layers panel, backgrounds, CMYK / PDF export, AI, auth, billing, e-paper article map, WhatsApp cards. They come after the gate.

## Finish

Run `npm run harness -- --phase 0`. Flip G0.flow to `active` in `harness/gates.json` once `packages/engine/test/flow.test.js` has at least 5 passing tests (the gate counts them). Add a decision-log entry in `CLAUDE.md` with the gate outcome. Update `Current phase` in `CLAUDE.md` only if the gate is GO.
