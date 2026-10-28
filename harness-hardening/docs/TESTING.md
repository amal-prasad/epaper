# Testing and debugging

Principle: Claude builds, a script judges. A task is done when a command prints PASS, never when Claude says it works. This file says which command, for which kind of risk.

## The loop for every task

1. Write the "done" command first (a test file, or a gate in `harness/gates.json`). If you cannot name it, the task is too vague.
2. Build in a small step, about an hour of work.
3. Run `npm test` and `npm run harness -- --phase N`. Paste the real output.
4. Green: commit. Red: fix the code, never the test or the gate (CLAUDE.md rule 12).

## Layers

| Layer | What it proves | Tool | Speed |
|---|---|---|---|
| Invariants and fuzz on the engine | Text is never lost, lines never overlap photos, undo restores exactly | `node:test` + fake canvas, no browser, no fonts | seconds |
| Parity | Pretext breaks lines like the real browser, per font | `spike/run.mjs` + `docs/FONTS.md` | minutes |
| Golden pages | A fixed sample issue still renders the same | Playwright screenshot diff against a stored reference | minutes |
| Preflight script | Export PDFs are print-safe: fonts embedded, K-only black, bleed | script on every exported PDF (Phase 2) | seconds |
| UX lint and axe | Primary action, touch targets, contrast, focus | `npm run ux` | seconds |
| Humans | A real person finishes a first page in 5 minutes | `docs/USABILITY_TEST.md` | per phase |
| Paper | It looks right printed | one real printed page a week, then the printer's proof | weekly |

Do not chase coverage numbers. Test the things that would cost a printed issue.

## The flow() contract

`flow(story, frames, obstacles, { font, lineHeight })` returns `{ lines: [{frameId, x, y, w, text}], remainder }`.
`frames` = ordered `[{id, x, y, w, h}]`; `obstacles` = `[{x, y, w, h, margin}]`. Every result must satisfy:

1. **Conserved.** Lines plus remainder equal the story, ignoring whitespace only. Nothing lost, duplicated or reordered. ZWJ and ZWNJ count.
2. **Inside frames.** Every line is inside its frame.
3. **Clear of obstacles.** No line touches an obstacle or its margin.
4. **Fits.** A line is never wider than its box. Only exception: a single grapheme cluster, which cannot be split.
5. **Reading order.** Frames in the order given, lines top to bottom.
6. **Deterministic.** Same input, same output.
7. **No overlap.** No two line boxes overlap. Two lines on one row (either side of a photo) are fine, left before right.
8. **No premature overflow.** Text goes to `remainder` only when the frames are full: every full-width free band of height L holds at least floor(L / lineHeight) - 1 lines. Without 7 and 8, a `flow()` that returns `{ lines: [], remainder: story }` passed every test (found 2026-10-28).

The helpers are in `packages/engine/test/helpers/invariants.js`. `invariants.test.js` tests the helpers themselves, so a broken checker cannot pass silently. `conservation.test.js` runs them on the real `flow()` with real Hindi copy plus 300 random fuzz cases, and is skipped until `flow.js` exists. Skipped tests are not counted as passed.

## The fake canvas

Engine tests run in plain Node with `helpers/fake-canvas.js`: every letter 7 px wide, combining marks zero. This proves the logic is correct without fonts or a browser, and it never flakes. It does not prove real font accuracy; the parity harness does. Both are needed, neither replaces the other.

Checked on 2026-10-28 against a throwaway reference `flow()`: all tests passed on the correct version. Injected bugs (dropped character, duplicated line, ignored obstacle margin, truncated remainder) were all caught.

## Undo fuzzing

`fuzzUndo({ makeDoc, ops })` applies up to 40 random ops, then undoes them all, and requires the document to be identical to the start. It also fails if an op mutates its input. Failures print `[fuzz seed N]`; replay one with `FUZZ_SEED=N npm test`. Every new op in Phase 1 gets registered with it before it is used by the UI or the auto-pager.

## Bugs

1. Reproduce with the exact input (copy the paragraph, the frames, the font).
2. Write a failing test that contains that input. Add the input to `spike/samples` or `harness/corpus` so it stays in the regression set.
3. Find the cause. Add logging or bisect; do not guess.
4. Fix. Run all tests and the harness.
5. If the cause was not obvious, add a two-line entry to `docs/DEBUG_LOG.md`: symptom, cause.

From Phase 1, customers report problems with the "Report a problem" button, which exports the document and its op log. `npm run replay <file>` rebuilds it. That makes every bug reproducible without screenshots on WhatsApp.

## Who judges the judges

AI tends to make a red test green by weakening it. Three layers stop that, each catching what the one before misses.

| Layer | What it does |
|---|---|
| `.claude/hooks/protect-gates.mjs` (before every edit and shell command) | Blocks Claude from touching `.claude/`, the harness runners, `harness/results/`, the judges lock and ratchet, and from changing (not adding to) existing tests and helpers. Blocks the shell tricks it can recognise (`sed -i`, redirects, `touch`, `node -e`, `python -c`, `git checkout` on those paths) and any command that mentions the human-only levers. A speed bump: a shell can always find another way. |
| `harness/judges.mjs` + `harness/judges.lock.json` | Fingerprints every judge: gates, runners, hooks, settings, the spike scorer (`spike/run.mjs`, `spike/src/main.js`), launch fonts, npm scripts, the Rules section of `CLAUDE.md`. Existing test files and helpers are append-only: approved lines must stay, new code may only be added between top-level statements, and added `.skip`/`.only`/`process.exit`/rewired `assert` are refused. `npm test` and `npm run harness` fail on any unapproved change, however it was made (hook, shell, `git apply`, a script). |
| `harness/test-ratchet.json` | A test file may never lose tests or gain skipped tests (catches `flow.js` being deleted so the contract tests quietly skip again). Raised automatically, lowered only by approval. |

Plus `stop-check.mjs` (Claude cannot finish while `npm test` fails: two attempts, then it must explain) and the `reviewer` agent (cold review of the diff, judges first).

**When Claude changes a judge on purpose** (flipping a gate to active, Phase 0 task 4 in `spike/run.mjs`, a new gate from the plan review): it is allowed, but `npm test` goes red and Claude has to stop and tell you. You read the diff, then in your own terminal:

    npm run approve            # lists every change, names LOOSENED gates, shows the git diff, asks
    npm run approve -- --yes   # Git Bash (mintty) cannot take keyboard input in Node; read the list first
    npm run approve -- --yes --loosen   # only if a gate got easier or an approved test line changed; add a decision-log row

Then commit `harness/judges.lock.json` and `harness/test-ratchet.json` with the change.

**Hand-measured gates** (G1.time, G1.sus, G2.proof...) are recorded only by you, with who, when and which build:

    npm run record -- G1.time minutes=52 --by Amal --note "issue 2026-11-04"

The harness refuses a hand-measured result without `measuredBy`, `date` and `build`.

**Lifting the hook** for a rare change Claude should make to a locked file (a hook bug, a runner fix): create the empty file `.claude/ALLOW_PROTECTED_EDITS` (it stops working after 60 minutes; delete it when done), or start one session with `STUDIO_ALLOW_PROTECTED=1 claude`. The judges lock still needs your approval afterwards.

**Weekly habit**, because no layer is perfect: `git diff harness packages/*/test .claude spike/run.mjs spike/src` before you push. After installing or changing hooks, run `/hooks` inside Claude Code to confirm both are registered. Hook tests: `harness/test/hooks.test.mjs`; lock tests: `harness/test/judges.test.mjs`; both run with `npm test`.

Claude Code is also denied `git push`, `git commit --no-verify`, `npm run approve`, `npm run record` and reading `.env` files (`.claude/settings.json`).

## Gates: running them

- In the build loop: `npm run harness -- --phase 0 --fast` (skips the slow parity run).
- Phase exit: `npm run harness -- --phase 0 --done`. Pending or skipped gates count as failures; a phase is not done because nothing is red.
- A gate that runs a command deletes its old result first, so it can never pass on yesterday's numbers.
- G0.parity also requires 40+ real paragraphs and no invented `news-sample.txt`. G0.flow requires the contract tests to run, not skip.

## CI

`.github/workflows/ci.yml` runs unit tests (including hooks and the judges lock), UX lint and the Phase 0 gates on every push, with `npm ci`. Commit both lockfiles and your real samples in `spike/samples/` (own content; keep the repo private if you would rather not publish them). It has not yet run on GitHub: if a step fails for environment reasons, fix the workflow, not the test.

## Not doing

- Mocking Pretext. The fake canvas feeds the real library fake metrics instead.
- Screenshot tests of every screen. Only the golden sample issue and the first-run flow.
- Testing third-party code. We test our wrapper and our fonts.
