# Phase 1 gate preparation implementation plan

**Goal:** Build reviewable golden-page candidates, deterministic auto-placement proposals, and a local production-measurement workflow for the three remaining Phase 1 gates.

**Authorization:** Amal explicitly authorized three Sol agents working in parallel for this step on 2026-11-02. This is a task-specific exception to the normal single-builder rule. Preserve the existing uncommitted export integration. No worktrees, commits, pushes, gate edits, judge approvals, or human metric recording are part of this task.

**Architecture:** Three independent workstreams use the existing engine, operations and renderer. The root agent owns shared documentation, demo registration and integrated verification. Candidate images remain unapproved until reviewed; production summaries remain separate from harness evidence.

**Tech stack:** Existing JavaScript ES modules, node:test, Playwright, bundled fonts and the local export pipeline. No new runtime dependencies.

## 1. Golden-page preparation

- Create ten deterministic representative fixtures and a candidate gallery under `demos/golden-pages/`.
- Implement standalone comparison scripts, manifests and provenance under `scripts/*golden*`.
- Add new comparator tests in `packages/export/test/golden*.test.js`: identical inputs pass, deliberate visible defects fail, missing baselines fail clearly.
- Keep generation separate from baseline acceptance. Document human review and proposed comparison policy in `docs/golden-pages.md`.
- Generate and open `demos/golden-pages.html`, checking browser console errors.

## 2. Auto-page v0

- Add `packages/engine/src/autopage.js` and a new focused test file.
- Assign stories deterministically by priority to available fitting slots using existing reversible operations.
- Preserve locked placements and source copy; expose changes and unresolved overflow. Frame chains and automatic continuation remain unsupported until the document and exporter support them together.
- Test immutability, ties, locks, fit failure and operation reversal before building the demo.
- Generate before/after previews in `demos/autopage.html`; document usage and boundaries in `docs/autopage.md`.

## 3. Production measurements

- Add isolated validation and aggregation modules/tests in `packages/production/` plus `scripts/production-log.mjs`.
- Store explicit operator-supplied records locally. Reject invalid counts, times and duplicates; protect previous records during writes.
- Summarize the last four real produced issues without excluding unpaid work or Janshakti. Explain eight-page qualification and do not silently select easier issues.
- Clearly separate synthetic demonstrations from qualifying measurements. Provide suggested recording commands only when sufficient evidence exists; never run them.
- Generate and browser-check `demos/production-log.html`; document the workflow in `docs/production-log.md`.

## 4. Integration and review

- Review implementation against the scope and cross-check production/placement terminology.
- Register all three demos in `demos/tasks.json` and append decision/risk documentation.
- Run focused tests, then `npm test`, `npm run harness -- --phase 1`, `npm run demos`, and `git diff --check`.
- Run independent review using agents that did not author the reviewed work; resolve actionable findings and repeat affected checks.
- Refresh the graph with `graphify update .`.

## Completion boundary

This task can complete the supporting implementation. It cannot manufacture accepted visual baselines or four real production trials. Gate activation and judge approval remain Amal's process. Report actual checks and remaining human work separately.

## Integrated result

Implemented all three preparation workstreams. The final candidate gallery links to `demos/golden-pages-v2/`; the earlier sparse candidates remain unapproved authoring artifacts. Ten repeated renders were identical. The denser inner/back fixtures contain 117/102 body lines; actual headline, geometry and font defects were rejected.

Fresh `npm test`: **447 passed, 0 failed**. The complete captured output is [test output](../../demos/phase1-verification-tests.txt). `npm run harness -- --phase 1` passes four active gates and leaves the three evidence-dependent gates pending; see the complete [gate output](../../demos/phase1-verification-gates.txt). Judge verification reports `ok: true` with five new test files. No judge or gate edits were made by this task.

All three demo pages load and decode their images in Chromium with zero page/console errors. The rebuilt index contains all three links. Agent cross-reviews found no actionable blockers; root additionally inspected the sparse and denser golden pages and requested the density correction. `npm run demos`, `graphify update .` and `git diff --check` completed. Graph refresh required escalation because the sandbox could not read the user Git ignore configuration; the rerun succeeded.

Risk sweep recorded GG-077, GG-078 and GG-079. Human baseline review, formal golden-gate integration, production trials, operator controls and off-machine recovery remain next steps. No commit or push was made.
