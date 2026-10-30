# Proposed automation (not applied)

Nothing here is active. `.claude/` is hook-protected and these files change Amal's machine settings only if Amal copies them. Source: `docs/PLAN_REVIEW.md` §11. CLAUDE.md wins over plugin skills: no git worktrees and no parallel subagents to build.

To adopt, copy a file into `.claude/agents/`, `.claude/commands/` or `.github/workflows/` yourself.

| File | What it does |
|---|---|
| `agents/hindi-typography-reviewer.md` | Reviews rendered PNG/PDF output for shirorekha breaks, conjunct clipping, danda placement |
| `agents/red-team.md` | Once per phase end: reads plan and gate results, lists wishful numbers and weakened gates |
| `agents/reviewer.md` | Replaces `.claude/agents/reviewer.md`: adds the task risk-sweep check and the phase-end gate audit against `docs/GATE_GAPS.md` (CLAUDE.md rule 9, D-027) |
| `commands/task.md` | Replaces `.claude/commands/task.md`: adds step 7, the risk sweep into `docs/GATE_GAPS.md` (CLAUDE.md rule 10, D-027) |
| `commands/bug.md` | `/bug <symptom>`: reproduce, failing test with the exact input, cause, fix (CLAUDE.md rule 11); referenced in CLAUDE.md but missing |
| `commands/review.md` | `/review`: asks the `reviewer` agent for a cold review of the diff; referenced in CLAUDE.md but missing |
| `commands/phase.md` | `/phase`: prints the current phase scope, gates and cut-line |
| `ci/harness.yml` | GitHub Actions: `npm test` and `npm run harness -- --fast` on push; slow parity weekly |
