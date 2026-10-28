# Harness

## What "harness" means here

A harness is a test rig: a script that feeds your code known inputs, compares the output with ground truth, and prints a number. It answers "does this work?" with a measurement instead of a feeling.

For this product, ground truth is one of three things:
- **The real browser.** Does our engine break Hindi lines where Chromium does? (Phase 0 spike.)
- **A golden file.** A saved correct output (a layout, a rendered page image, a PDF) that new runs must match.
- **A human measurement.** Time-to-issue, recorded by hand in `harness/results/*.json`.

The harness is also how Claude Code knows it is done. A phase is finished when its gates pass, not when the code looks finished.

(Separate meaning, for reference: "Claude Code" itself is called an agent harness, the loop of tools and prompts around the model. That is not what this folder is.)

## How it works

`harness/gates.json` lists gates. Each gate has a phase, a command that produces a metric file (or none, for hand-measured metrics), the file and key to read, and a threshold.

```
npm run harness                # all active gates
npm run harness -- --phase 0   # one phase
npm run harness -- --list      # show everything, including pending gates
```

Output is a table with PASS / FAIL / PENDING / SKIP. Exit code is 1 if any active gate fails. `target` is the "good" level above the minimum `threshold`; a gate between the two passes with a WARN.

## Adding a gate

1. Write the check so it writes JSON to `harness/results/<id>.json` (or to a path under `spike/out`).
2. Add an entry to `gates.json` with `status: "active"`.
3. Say in `CLAUDE.md` what the gate protects.

## Planned gates

| Gate | Phase | Metric | Ground truth |
|---|---|---|---|
| G0.parity | 0 | % of line breaks equal to real DOM | Chromium on bundled fonts |
| G0.flow | 0 | `flow()` unit tests pass | Hand-built fixtures |
| G1.fillrate | 1 | % of stories auto-placed with no manual fix | 20 past Janshakti issues replayed |
| G1.fitdrift | 1 | % of frames where fit meter differs from rendered result | Rendered page |
| G1.golden | 1 | Pixel diff of 10 reference pages | Golden PNGs |
| G1.time | 1 | Minutes to build one real weekly | Stopwatch, recorded by hand |
| G1.dedupe | 1 | F1 of duplicate detection | 50 duplicate + 50 distinct Hindi pairs |
| G1.licence | 1 | Approved stories without source licence | Database query |
| G0.guard | 0 | Repo guardrail tests failing | Tests (brand name, stock-asset licences) |
| G1.firstpage / G1.usability / G1.sus | 1 | First page in 5 min; tasks done unaided; SUS | 5-person usability test (`docs/USABILITY_TEST.md`) |
| G1.a11y / G1.ux | 1 | axe serious violations; UX-rule violations | `npm run ux` on Easy-mode routes |
| G2.pdfx | 2 | PDF/X valid, fonts embedded, CMYK only | veraPDF or Ghostscript checks |
| G2.preflight | 2 | Seeded faults caught / seeded faults | 10 deliberately broken pages |
| G2.proof | 2 | Printer accepts proof (0/1) | Real printer |
| G3.accept | 3 | % of AI suggestions accepted in beta | Usage log |
| G4.a11y | 4 | Axe violations; keyboard-only task completion | Axe + scripted run |
| GX.perf | all | Drag relayout ms; autopage s; first load s | Benchmarks |

## Rules for good gates

- A gate measures one thing. If it fails, you can tell why.
- Seed it with real data (Janshakti copy), not invented text.
- Thresholds are written before the code is, and changed only with a decision-log entry.
- Hand-measured gates must record who, when, and what build.
