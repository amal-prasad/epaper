# Harness hardening update (2026-10-28)

Apply on top of studio-kit + fonts + testing + harness updates. In Git Bash, with Claude Code closed:

    cd /d/epaper
    git add -A && git commit -m "before harness hardening"     # so you can diff and roll back
    # extract the zip anywhere, then copy everything INSIDE its harness-hardening/ folder into D:\epaper, overwriting
    # (Explorer works; or: unzip -o harness-hardening.zip -d /tmp/hh && cp -r /tmp/hh/harness-hardening/. .)

    npm install                         # engine now depends on @chenglou/pretext; refreshes package-lock.json
    (cd spike && npm install)           # the shipped spike lockfile was out of sync (Playwright missing)
    node harness/tools/add-testing-rules.mjs    # refreshes rules 10-16, harness section, commands, decision rows in CLAUDE.md
    git add --renormalize .             # applies .gitattributes (LF everywhere)

    npm run approve -- --yes            # first run: records today's judges as the approved baseline
    npm test                            # all green, 12 conservation tests skipped until flow.js exists
    npm run harness -- --phase 0        # G0.parity: needs real samples, no news-sample.txt; G0.flow: red until flow.js

    git add -A && git commit -m "Harness hardening: judges lock, flow invariants, real-copy parity gate"

Not overwritten on purpose: `CLAUDE.md` (the tool above edits it in place, keeps your decision log), lockfiles,
`spike/package.json` (it holds your installed @fontsource packages), your samples, fonts and results.

Then open Claude Code in /d/epaper and run `/hooks` to confirm both hooks are registered.
Read docs/TESTING.md, section "Who judges the judges", for the new approve and record workflow.
