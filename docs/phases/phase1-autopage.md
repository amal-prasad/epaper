# Phase 1 — Auto-page v1 + Guided editing

Read `CLAUDE.md` and `docs/PRODUCT_PROMPT.md` first. Phase 0 must be GO or GO-with-caveat (`docs/PHASE0_DECISION.md`). No LLM in this phase.

## Goal

A Janshakti editor pastes or types the week's own stories, picks a format, and the app builds all pages. The editor fixes what is wrong with the Guided toolbar. The result saves, reloads identically, and previews as an e-paper.

## Specs (the designs in `docs/design/`)

- `AutoPage.dc.html`: inbox, lock-in-place, 3 layout options per page, change list with accept/undo.
- `Guided.dc.html`: 7-step flow, per-block toolbar, overlays on photos, masthead ears.
- `Typography.dc.html`: columns per article, gutter, column rule, headline-across, intro paragraph, text roles, font pickers.
- `Backgrounds.dc.html` (stock only), `Assets.dc.html` (V1-tagged assets only).

## Tasks

0. **UI system first (`docs/UX_SPEC.md`).** Create `packages/ui`: design tokens (colour, type, space, focus, motion), Hindi/EN string files, and the 12 components in UX_SPEC §15, each with loading/empty/error/offline states, keyboard behaviour, and a story page. Mark screens with `data-ux="primary"`, `"toolbar"` and `"help"` so `npm run ux` can check them. Add Home, issue checklist, first-run (sample page + 5 coach marks), and the help hub to `docs/DESIGN_GAPS.md` and get them designed before building them.
1. **App shell.** Create `apps/web` (Next.js 14 App Router, Tailwind, TypeScript). Supabase auth, orgs, roles (owner/editor/reporter), RLS by `org_id`. Hindi UI strings from a single `strings.hi.ts` with an EN mirror.
2. **Document model and ops.** `packages/engine`: types from the master prompt, `schemaVersion`, `apply(doc, op)` with inverse, op log, undo/redo, migrations. Property tests: every op passes `fuzzUndo` (`packages/engine/test/helpers/fuzz.js`: apply random ops, undo all, document identical; ops never mutate input); random op sequences never produce overlapping text frames or negative sizes.
3. **Brand setup (design it first in `DESIGN_GAPS.md`).** Masthead upload with ears, colours, fonts, RNI imprint, page size, grid. Seed Janshakti.
4. **Story desk (basic).** Create/paste/edit story, Kruti Dev and Chanakya to Unicode converter with preview and undo, priority, photo attach, word and line counts.
5. **Templates.** Five weekly templates (front page lead + secondary, inner news page, sports page, feature page, ad/greetings page) as data: frames, slots, default objects. Template editor is out of scope; templates are JSON files.
6. **Auto-pager.** `autopage({ stories, template, locks })` returns up to 3 candidate layouts per page with a list of changes. Deterministic. Rules: priority to slots, fit by trimming column count or photo size before overflow, overflow creates a jump line to a later page, locked placements never move. Every action it takes is an op.
7. **Fit meters.** `fit(story, frame)` returns fill %, overflow lines, underfill lines. Fit meter must equal what the renderer draws (gate G1.fitdrift).
8. **Guided editor.** Implement the toolbar ops from the Guided design with pointer drag-resize and keyboard equivalents. Photos move across columns and stories; overlays on photos; wrap side toggle; colour cycle.
9. **Backgrounds (stock).** 8 stock backgrounds with licence file each, opacity, white layer behind text, print warning.
10. **Preview and save.** Page strip, autosave via op log, version snapshots, reload test. E-paper-style preview (images are fine; article map comes in Phase 2).
11. **Corpus.** Build `harness/corpus/` from 20 past Janshakti issues (stories as text, photos as files, the final page order). Write the replay script that auto-pages each issue and compares placement with what the editor actually did.

12. **Content desk v1 (decision D-009).** (a) Import from the customer's own website or RSS (their own stories only). (b) **Lead radar**: headlines, source name and link from a paid news API, shown as story tips in a side panel; never insert third-party body text into a story; check the provider's terms (GNews: commercial use needs an active paid plan, no resale of API access) and record the plan in the decision log. (c) `dedupe(stories)` in `packages/engine`: normalise Devanagari (nukta, chandrabindu/anusvara, digits, punctuation), shingle, score; flag near-duplicates with a reason and let the editor keep, merge or dismiss. Build a seeded set of 50 duplicate and 50 non-duplicate pairs from real Hindi copy. (d) Required `source` and `licence` on every story; approval is blocked when licence is `none`; the badge shows in the desk and on the page proof. (e) Priority sorting feeds the auto-pager.

Not in this phase: agency feeds, the sharing pool, scraping, AI rewrite of other publishers' copy.

13. **Usability rounds.** At the end of the phase run `docs/USABILITY_TEST.md` with 5 real people; fix the top five problems; retest with 2 new people. Record in `harness/results/`.
14. **Accessibility.** Keyboard path for every Easy-mode task, 200% zoom, TalkBack and NVDA pass, drag alternatives for every drag. `npm run ux` runs in CI on every pull request.
15. **Bug bundle and replay.** A "Report a problem" action exports `{ document, opLog, appVersion, fontsVersion }` as one JSON file. `npm run replay <file>` rebuilds the document from the op log and re-renders it, so any customer bug can be reproduced on your machine. Every bug found from here on gets a failing test first (CLAUDE.md rule 11).

## Harness gates to activate

G1.fillrate (>= 70% auto-placed without manual fix), G1.fitdrift (<= 2% of frames), G1.golden (10 pages, pixel diff under the threshold set in the decision log), G1.time (<= 60 min for one real weekly, recorded by hand), G1.dedupe (F1 >= 0.90 on the seeded pairs; revise after the first run and log it), G1.licence (0 approved stories without a licence), G1.firstpage (4 of 5 see a filled first page within 5 minutes), G1.usability (4 of 5 finish T2–T6 unaided), G1.sus (mean >= 75; revise after round 1 and log it), G1.a11y and G1.ux (0 violations from `npm run ux`).

## Done when

Janshakti builds one real weekly issue end to end in the app, three design partners have tried it with their own stories, and `npm run harness -- --phase 1` passes. Record partner feedback in `docs/PARTNERS.md`.

## Out of scope

PDF/CMYK export, WhatsApp intake, billing, phone mode, own fonts, rulers, contour wrap, background upload, AI.
