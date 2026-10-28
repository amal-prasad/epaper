# Studio kit — Hindi page-layout product

Everything Claude Code needs to build the product in gated phases. **Open `docs/START_HERE.md` first.**

| File | Purpose |
|---|---|
| `docs/PRODUCT_PROMPT.md` | Master brief: product, rules, architecture, data model, design map, gaps, phases |
| `CLAUDE.md` | Project memory and decision log (Claude Code reads this every session) |
| `docs/phases/phase0..4` | One self-contained prompt per phase, each with gates |
| `docs/HARNESS.md` | What the harness is, how to add a gate |
| `harness/` | Gate runner (`npm run harness`) and gate definitions |
| `spike/` | Phase 0 Pretext-vs-DOM parity test (working, already run once) |
| `docs/design/` | The 10 approved mockup boards (reference; published copy: https://claude.ai/artifact/T4G2YCeHkePv24C7wXUEQd) |
| `docs/UX_SPEC.md` | Binding UX: principles, flows, plain-Hindi glossary and microcopy, accessibility, UI system |
| `docs/USABILITY_TEST.md` | 5-person test script, tasks, scoring |
| `harness/ux/` | `npm run ux`: UX and accessibility lint (one primary button, toolbar size, target size, focus, axe) |
| `docs/DESIGN_GAPS.md` | Screens not designed yet; add before building |
| `docs/PLAN_ENHANCEMENT_PROMPT.md` | Run first in Claude Code plan mode (`opusplan`): red-teams this kit and produces the enhanced plan |

## Start

    ./bootstrap.sh ~/code/studio
    cd ~/code/studio
    claude --model opusplan     # Shift+Tab to plan mode, paste docs/PLAN_ENHANCEMENT_PROMPT.md, approve the plan
    # then: Read CLAUDE.md and docs/PRODUCT_PROMPT.md, then execute docs/phases/phase0-engine.md.

Needs Node 20+, git, and a machine that can download Chromium for Playwright.
