---
description: Build one small task with the test-first loop. Usage /task <what to build>
argument-hint: <what to build, e.g. "Phase 0 task 5: flow.js">
---
Task: $ARGUMENTS

Follow this loop exactly. Do not skip a step.

1. Read `CLAUDE.md` and the phase file named in "Current phase". Restate the task in two sentences.
2. Name the DONE command (a test file, or the gate ids in `harness/gates.json`). If none exists, write the failing test first and show it failing.
3. Plan in at most 5 bullets. If the task is larger than about an hour of work, stop and propose how to split it. Consult the advisor on the plan before implementing.
4. Implement. Do not change `harness/gates.json`, existing tests, test helpers or `.claude/` (rule 12; hooks and the judges lock will catch it anyway).
5. Run `npm test` and `npm run harness -- --phase <current phase> --fast`. Paste the real output tables, not a summary. If `npm test` says a judge changed, stop: list what you changed in which judge file and why, and ask Amal to review and approve.
6. If green: run `git diff --stat`, then commit locally with a message that names the task (do not push). If red: fix the code and repeat step 5. After 2 failed attempts, consult the advisor. After 3, stop and explain what you tried and what the output says.
7. Risk sweep (rule 10): for input/paste, layout, editing, export, print, e-paper and backups, ask what this task could break on a real issue that no gate checks. Add each new risk as a `docs/GATE_GAPS.md` row (source "task sweep") and run `node scripts/gate-gaps.mjs`, or write "no new risks" in the report.
8. Before finishing, consult the advisor to check the diff against the task, the rules and the gate output. Then finish with: what changed, the gate numbers, the risk sweep result, and the next task.
