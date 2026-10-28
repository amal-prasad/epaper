---
description: Run the harness gates for the current phase and report honestly
argument-hint: [phase number, default = current phase in CLAUDE.md]
---
Run `npm test`, then `npm run harness -- --phase $ARGUMENTS --done` (if no phase was given, use the current phase from `CLAUDE.md`). Paste the real tables. Then give: which gates pass, which fail or are pending, whether the judges match Amal's approval, and the single most useful next task. Do not change any threshold, test or gate to improve a result. If a gate looks wrong, show the evidence and ask.
