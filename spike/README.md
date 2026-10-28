# Phase 0 spike — does Pretext lay out Hindi like a real browser?

    npm install
    npx playwright install chromium
    npm run spike          # writes out/report.md and out/report.json

Run `node harness/tools/fetch-janshakti-samples.mjs` from the repo root to pull real paragraphs from your own site, or drop real Janshakti stories (plain .txt, blank line between paragraphs) into `samples/`
before trusting the number. The bundled sample is 10 invented news paragraphs.
Fonts are bundled in `public/fonts` (Noto Sans/Serif Devanagari, Mukta; OFL licence).
