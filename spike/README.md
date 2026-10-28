# Phase 0 spike — does Pretext lay out Hindi like a real browser?

    npm install
    npx playwright install chromium
    node add-fonts.mjs     # installs the fonts in fonts.json (Devanagari + Latin) and writes public/fonts.css
    npm run spike          # launch fonts; writes out/report.md and out/report.json

Real copy first: run `node harness/tools/fetch-janshakti-samples.mjs` from the repo root, or drop your own stories
(plain UTF-8 .txt, blank line between paragraphs) into `samples/`, then delete `samples/news-sample.txt`.
Gate G0.parity refuses to pass with fewer than 40 real paragraphs or while the invented sample is present.
Font testing in detail: `docs/FONTS.md`. `run.mjs` and `src/main.js` are judges: changes need Amal's `npm run approve`.
