# Fonts + overflow-check update (2026-10-28)

Apply AFTER harness-hardening.zip. Git Bash, Claude Code closed:

    cd /d/epaper
    git add -A && git commit -m "before fonts update"
    # copy everything INSIDE fonts-overflow-update/ into D:\epaper, overwriting

    node harness/tools/update-gates.mjs      # adds "0 overflows" (and the real-copy checks, if missing) to G0.parity
    npm test                                 # red: "judge changed" (scorer, fonts.json, gates) - expected
    npm run approve -- --yes                 # read the list it prints first
    npm test                                 # green

    cd spike
    node add-fonts.mjs                       # installs all 61 fonts (one-time, ~10 MB)
    node run.mjs                             # GATE run: Noto Sans + Serif only
    cd .. && npm run harness -- --phase 0    # G0.parity should PASS with "longerThanDom 0"
    git add -A && git commit -m "61 Devanagari fonts, overflow check in G0.parity"

Then screen (each writes spike/out/report-screen.md, never the gate report):

    cd spike
    node run.mjs --roles text,text-serif --out body       # every body font at body sizes (long: 15-30 min)
    node run.mjs --headline --out headline                # headline/display/handwriting at 20-48 px bold
    node run.mjs --headline --fonts "Noto Sans Devanagari,Noto Serif Devanagari" --out headline-noto

Read the "overflows" column first. Details: docs/FONTS.md.
