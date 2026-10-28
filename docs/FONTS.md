# Fonts: which ones, how they were tested, how to test more

Measured 2026-10-28, Chromium, 121 real Janshakti paragraphs, Devanagari **and Latin** subsets bundled. Parity = every line break in the paragraph matches the real browser. All fonts are Google Fonts under the SIL OFL; check each `spike/public/fonts/licenses/*.txt` before shipping.

## Rule

A font may drive the live editor only if it scores >= 99.5% on real copy **and** its halant/conjunct checks are clean (widths 66/66, breaks >= 99%). 95-99.5% = preview only, server layout for final. Below 95% = server layout only. Parity says nothing about how a font looks in print; judge that on a proof.

## Full runs (5 widths x 2 sizes + obstacles, ~1,700 comparisons per font)

| Font | Role | Real copy | Halant breaks | Verdict |
|---|---|---|---|---|
| Sarala | text | 99.8% | 100% | PASS |
| Khand | headline | 99.8% | 100% | PASS |
| **Noto Serif Devanagari** | text-serif, **launch** | 99.7% | 99.6% | PASS |
| Hind | text | 99.6% | 100% | PASS |
| Martel | text-serif | 99.6% | 99.6% | PASS |
| Yantramanav | text | 99.6% | 100% | PASS |
| **Noto Sans Devanagari** | text, **launch** | 99.5% | 100% | PASS |
| **Halant** | text-serif | 99.5% | 100% | PASS |
| Baloo 2 | text | 99.4% | 100% | CAVEAT |
| Mukta | text | 99.1% | 100% | CAVEAT |

Launch fonts combined: 3374/3388 = **99.6%** (gate metric).

## Quick screen (2 widths x 1 size, ~240 comparisons per font, about +/-0.5% noise: screening only, re-run `--fonts` before adopting)

PASS: Laila, Amiko, Glegoo, Jaldi, Pragati Narrow, Teko, Eczar, Karma, Biryani, Cambay, Sura, Arya, Palanquin, Rajdhani, Kalam.
CAVEAT: Rozha One, Yatra One (display faces).
FAIL: **Tiro Devanagari Hindi (~79%)**, **Vesper Libre (~57%)**. Cause undiagnosed. Tiro is the best-regarded Hindi text face, so it is worth a Phase 0 hour; until then it is server-layout only.

## Suggested roles (v1)

- Body: Noto Sans, Noto Serif (launch). Add Sarala, Hind, Martel, Halant after their full runs are repeated on your machine.
- Headlines: Khand, Eczar, Arya, Rajdhani.
- Display / banner: Teko, Rozha One, Yatra One.
- Handwritten (school magazines): Kalam.

## About "halant" fonts

- **Halant** is a Google Font (Devanagari serif, Indian Type Foundry). It passes, includes Latin, and is in `fonts.json`.
- Separately, the OpenType feature `haln` forms halant glyphs. Fonts that have it: Halant, Hind, Khand, Mukta, Yantramanav, Laila. Noto Sans/Serif, Sarala and Martel do not; they still match the browser on every halant word tested, because they shape halants through other features (`half`, `akhn`, `rphf`, `blwf`). The check measures widths and line breaks, not appearance: eyeball a proof of words like विद्वान्, श्रद्धा, ट्ट.
- All fonts tested contain U+094D, U+200C, U+200D, U+093C and U+25CC.

## Run it

Inside `spike/` (Git Bash):

```
node add-fonts.mjs                      # install every font in fonts.json (Devanagari + Latin) into public/fonts, writes fonts.css
node run.mjs                            # launch fonts only: this is the gate number
node run.mjs --fonts "Halant,Hind"      # chosen fonts, full test
node run.mjs --all --quick              # screen every font (about 2 minutes)
node run.mjs --all                      # everything, full test (slow: allow 20+ minutes)
```

Then `cd .. && npm run harness -- --phase 0`. Results: `spike/out/report.md` (per-font table at the top) and `report.json`.

## Add a font

1. Find its id at fontsource.org (Google Fonts name, lowercase, hyphens).
2. Add a row to `spike/fonts.json`: `{ "name": "Exact Family Name", "pkg": "fontsource-id", "role": "text" }`.
3. `node add-fonts.mjs "Exact Family Name"` then `node run.mjs --fonts "Exact Family Name"`.
4. Fonts that are not on Google Fonts (commercial, or Indian foundry files): drop the .woff2 into `public/fonts`, add an `@font-face` for both the Devanagari and a Latin face to `fonts.css` by hand, and add the row to `fonts.json`. Check the licence allows embedding in generated PDFs.

## Known limits

- One site, one day of copy, one browser engine (Chromium). A Windows run and a Linux run differed by one comparison out of 5,082.
- Only weight 400 is tested. Bold (700) files are bundled but not yet measured; italics are not tested (Devanagari has no true italic).
- Sizes 12 and 14 px and widths 90-320 px only. Phase 0 task 4 adds the rest.
