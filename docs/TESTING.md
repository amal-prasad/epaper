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

## Protecting the gates

AI tends to make a red test green by weakening it. Rule 12 forbids that. Review `git diff harness/gates.json packages/*/test` before every merge; any change there needs your approval. For anything that affects print output, a fresh Claude session that did not write the change reviews it, and the printer proofs it before the phase closes.

## CI

`.github/workflows/ci.yml` runs unit tests, UX lint and the Phase 0 parity gate on every push. It has not yet run on GitHub: if a step fails for environment reasons, fix the workflow, not the test.

## Not doing

- Mocking Pretext. The fake canvas feeds the real library fake metrics instead.
- Screenshot tests of every screen. Only the golden sample issue and the first-run flow.
- Testing third-party code. We test our wrapper and our fonts.
