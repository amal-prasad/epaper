---
description: Ask the reviewer agent for a cold review of the current diff
argument-hint: [optional focus, e.g. "export" or "ops"]
---
Run `git diff --stat` and `git diff`, then hand the diff to the `reviewer` agent with this focus: $ARGUMENTS. The reviewer must check for weakened tests or gates, broken CLAUDE.md rules, ops without inverses, and print risks. For anything that changes print output, fonts, colour or bleed, also run the `hindi-typography-reviewer` agent on rendered pages. Report findings as the reviewer wrote them; do not edit files.
