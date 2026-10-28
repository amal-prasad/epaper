# Phase 4 — Assist (AI, approval-based)

Renumbered by the plan review (2026-10-28): this was Phase 3. It now comes after self-serve (`phase3-selfserve.md`). File name kept. Gate ids G3.* stay; their phase field in `harness/gates.json` is 4.

Read `CLAUDE.md` and `docs/PRODUCT_PROMPT.md` first. Phases 1 and 2 must have passed.

## Principle

AI proposes; the user accepts. Every suggestion is an op list shown in the change panel with an undo. Nothing changes silently. Use the owner's own text only; no outside content.

## Tasks

1. **Trim to fit.** For an overflowing story, propose a shorter version (remove sentences, not meaning), show the diff, apply as an op on accept. Constraint: keep names, numbers and quotes unless the user ticks otherwise. Check by script that no number or proper noun was dropped.
2. **Headline and deck options.** 3 options with character counts that fit the headline slot; show fit before accept.
3. **Cutline (caption) draft** from the photo and the story text. Always editable; credit field is never generated.
4. **Photo crop.** Suggest a crop for a slot's aspect ratio; show it, user accepts. Warn on low dpi.
5. **Proof assist.** Flag likely typos and Kruti Dev leftovers; never auto-fix.
6. **Cost and privacy.** Per-org monthly AI budget, logged per call; stories are not used for training; document the provider terms in the decision log.
7. **Evaluation set.** 50 real stories with human-trimmed versions; score suggestions against them (facts preserved, length hit, readability judged by two humans).

## Harness gates to activate

G3.accept (>= 50% of suggestions accepted in the beta over two weeks), G3.facts (0 dropped numbers or proper names in accepted trims on the evaluation set), G3.cost (rupees per issue under the plan margin).

## Done when

Beta users accept at least half the suggestions, no accepted trim lost a fact, and `npm run harness -- --phase 3` passes.
