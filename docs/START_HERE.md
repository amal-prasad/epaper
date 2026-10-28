# Start here

Three steps. Do them in order.

## 1. Set up (10 minutes)

    ./bootstrap.sh ~/code/studio
    cd ~/code/studio

Then get 40+ real Janshakti paragraphs into `spike/samples/`. Easiest: on your own machine run

    node harness/tools/fetch-janshakti-samples.mjs

It reads your site's /samachar/ pages and writes `spike/samples/janshakti-live.txt` (UTF-8, blank line between paragraphs) plus a list of the URLs it used. If the pages are client-rendered and it finds nothing, export story bodies from your Supabase table instead. Then delete `spike/samples/news-sample.txt` (invented text) and run `npm run spike`.

**Fonts:** `cd spike && node add-fonts.mjs` installs the font list in `spike/fonts.json` with Latin glyphs included (needed for correct parity). Then `node run.mjs` tests the launch fonts, `node run.mjs --all --quick` screens every font. Details in `docs/FONTS.md`.

## 2. Plan review (Opus plans, then Sonnet executes)

    claude --model opusplan

Press Shift+Tab until the mode shows "plan". Paste this, nothing else:

    Read CLAUDE.md, then follow docs/PLAN_ENHANCEMENT_PROMPT.md exactly. Do not build anything.

Answer its questions (at most 7). Review the plan. Approve only when you agree with the first-14-days list and the revised phase estimates at your real weekly hours. After approval it writes `docs/PLAN_REVIEW.md`, `ROADMAP.md`, `EXPERIMENTS.md` and updates the phases, gates and decision log. If it keeps using Opus for execution, type `/model sonnet`.

## 3. Build, one phase at a time

New session, normal mode:

    Read CLAUDE.md and docs/PRODUCT_PROMPT.md, then execute docs/phases/phase0-engine.md. Stop when `npm run harness -- --phase 0` has a verdict and docs/PHASE0_DECISION.md is written.

Next phases: same sentence with the next phase file. Never skip a gate. Phase 2 starts only after three weeklies have agreed to pay.

## UX

The interface rules are in `docs/UX_SPEC.md` (friendly, plain Hindi, one next step, undo everywhere). Test it with real people using `docs/USABILITY_TEST.md`. `npm run ux` checks what a script can.

## Rules that save you

- One phase per session; end with the harness table and a decision-log entry.
- Say "UNVERIFIED" out loud when a number has no source.
- Run the experiments (conversations, concierge issue, content question) in parallel with Phase 0. Sales learning is not blocked by code.

**Testing:** read `docs/TESTING.md`. Run `node harness/tools/add-testing-rules.mjs` once to add the testing rules to `CLAUDE.md`. `npm test` runs the engine invariant and undo-fuzz tests; the flow tests are skipped until Phase 0 task 5 writes `packages/engine/src/flow.js`.
