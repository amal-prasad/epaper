# CLAUDE.md — project memory

Read `docs/PRODUCT_PROMPT.md` for the full brief. This file is the short version. The decision log lives in `docs/DECISIONS.md`: append to it, never rewrite it.

## Project
Hindi page-layout Studio: build a printable newspaper / school magazine from the publisher's own stories, publish the same layout as an e-paper. First customer: Janshakti Ujala (Indore weekly). Working name "Studio" (not "Patrika").

## Current phase
Phase 1 — operator tool and first produced issues. See `docs/phases/phase1-autopage.md`.

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
- `npm run demos` — rebuild `demos/index.html` (gate status, open gate gaps, task demos newest first) and `demos/gate-gaps.html`; `-- --full` includes the slow parity gate
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
9. Phase gates are hard. Do not start phase N+1 until `--phase N` passes. Phase 2 also needs 3 paying weeklies. At phase end the `reviewer` agent, which did not build the phase, audits the gates against the phase plan and `docs/GATE_GAPS.md` and writes a `docs/GATE_GAPS.md` row (source "phase review") for every uncovered risk; its rows are appended verbatim, never edited or dropped. Gate gaps are proposals: only Amal adds or changes a gate.
<!-- testing-rules -->
10. Done means a command passes. Name the command before writing code. After every task run `npm test` and `npm run harness -- --phase N` and paste the real output. "Should work" is not a result. End every task with a risk sweep across the pipeline (input/paste, layout, editing, export, print, e-paper, backups): add each new risk to `docs/GATE_GAPS.md`, or write "no new risks" in the task report.
11. Bug workflow: reproduce, write a failing test with the exact input, answer "which gate should have caught this?" (if none, add a `docs/GATE_GAPS.md` entry with source "bug"), find the cause (log or bisect; do not guess), fix, run everything. Keep the test forever. Add the input to `harness/corpus` or `spike/samples`.
12. Never loosen a gate or test to get green: do not lower thresholds in `harness/gates.json`, skip or delete a test, or change an expected value. If a gate or test looks wrong, stop and show Amal the evidence. Any change to a judge (gates, tests, test helpers, spike scorer, npm scripts, these rules) fails `npm test` until Amal reads the diff and runs `npm run approve`; when that happens, stop and tell him what you changed and why. The hook lets you edit tests and test helpers with Edit or Write (it blocks only edits that add skip, only, todo, exit or rewire assert), so a wrong test you wrote can be fixed; the judges lock is what holds approved tests. Never try to get around a hook or the judges lock.
13. flow() contract and invariants (`docs/TESTING.md`): text conserved, lines inside frames, clear of obstacles, never wider than the box, reading order, deterministic. The engine stays DOM-free; Node tests use `packages/engine/test/helpers/fake-canvas.js`.
14. Every op has an inverse and must pass `fuzzUndo` (`packages/engine/test/helpers/fuzz.js`). Ops never mutate their input.
15. One small task per commit (about an hour of work), committed only when green. Never commit with a failing test. Never push; Amal pushes.
16. Anything that changes print output (export, colour, fonts, bleed) is reviewed by the `reviewer` agent (a fresh session that did not write it), and gets a physical proof from the printer before a phase is called done.
17. Every task ends with a demo page Amal can open in a browser: `demos/<task-name>.html`, self-contained (inline CSS, images in `demos/<task-name>/`), listed in `demos/tasks.json` and linked from `demos/index.html` (`npm run demos`). Layout work shows before/after page previews side by side (`node scripts/demo-layout.mjs`); print work shows the ink plates side by side; non-visual work shows a short plain-words table of what changed and which checks passed. Open each page in Chromium and confirm it renders with no console errors. A task is not done until its demo page exists and is linked.
18. Whenever you need to ask Amal something, or need proof from him (a result or a check only he can do), make him a quiz: multiple-choice questions with the question tool, each one understandable on its own. Do not ask in prose. Log answers that decide something in `docs/DECISIONS.md`. A quiz answer does not replace `npm run approve` or `npm run record`, and a number he gives in one is still labelled as his, not as something you ran (rule 7).

<!-- claude-code-harness -->
## Claude Code harness (in `.claude/` and `harness/`)
- `/task <what>` builds one small task with the test-first loop. `/bug <symptom>` fixes a bug test-first. `/gate` reports the current phase gates. `/review` asks the `reviewer` agent for a cold review of the diff.
- Hook `protect-gates.mjs`: blocks edits to `.claude/`, the harness runners (`run.mjs`, `run-tests.mjs`), `harness/judges.mjs`, the judges lock and ratchet, `harness/tools/` and `harness/results/`. Tests and test helpers may be created, edited and rewritten with Edit or Write; only edits that add skip/only/todo/exit or rewire assert are blocked. Shell writes to tests stay blocked (the hook cannot check them). Read-only shell commands are allowed.
- `harness/judges.mjs`: every judge is fingerprinted in `harness/judges.lock.json`. Changing one (including `gates.json`, flipping a gate to active, or the spike scorer) is allowed, but `npm test` and the harness fail until Amal approves with `npm run approve`. Loosened gates are named in the approval.
- `harness/test-ratchet.json`: a test file may never lose tests or gain skips.
- Hand-measured results are recorded only by Amal: `npm run record -- <gate> <key>=<n> --by <name>`.
- Hook `stop-check.mjs`: Claude cannot finish while `npm test` fails (two attempts, then it must explain).
- If a hook or the lock blocks you, do not look for a workaround. Tell Amal what you wanted to change and why.

## Plugins in this project
- superpowers, caveman and ponytail are on. When a plugin skill or workflow disagrees with CLAUDE.md, `/task`, `/bug` or the hooks, CLAUDE.md and the hooks win.
- caveman shortens your prose only: always paste real `npm test` and harness output in full, and write docs, decision-log rows and commit messages in normal sentences.
- Do not use superpowers' git worktrees or parallel subagents to build; one task, one branch, committed only when green.

## Docs
Read on demand; these are plain paths, not imports.
- `docs/DECISIONS.md` — decision log (append-only) and open questions
- `docs/GATE_GAPS.md` — risks no gate covers yet (proposals; `node scripts/gate-gaps.mjs` renders `demos/gate-gaps.html`)
- `docs/PLAN_REVIEW.md` — approved plan, red-team findings, assumptions, sources
- `docs/ROADMAP.md` — 12-week calendar, hours budget, cut-lines, week-12 decision
- `docs/EXPERIMENTS.md` — first 14 days, pass/fail, buyer script
- `docs/phases/` — one file per phase (scope, tasks, gates)
- Also: `docs/PRODUCT_PROMPT.md`, `docs/UX_SPEC.md`, `docs/TESTING.md`, `docs/FONTS.md`, `docs/DESIGN_GAPS.md`
