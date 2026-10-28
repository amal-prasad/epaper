---
description: Fix a bug test-first. Usage /bug <symptom>
argument-hint: <symptom, with the exact input if you have it>
---
Symptom: $ARGUMENTS

Follow CLAUDE.md rule 11 exactly.

1. Reproduce. Find the exact input; if there is none, ask for it.
2. Write a failing test with that exact input. Show it failing. Add the input to `harness/corpus` or `spike/samples`.
3. Find the cause by logging or bisecting. Do not guess. State the cause in one sentence.
4. Fix the cause, in the shared function that all callers use, not at one call site.
5. Run `npm test` and `npm run harness -- --phase <current phase> --fast`; paste the real output. Never loosen a gate or test (rule 12); if one looks wrong, stop and show the evidence.
6. Add two lines to `docs/DEBUG_LOG.md` (symptom, cause). Commit locally when green; do not push.
