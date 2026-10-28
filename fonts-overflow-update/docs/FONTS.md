# Fonts: which ones, how they were tested, how to test more

`spike/fonts.json` lists all 61 Google Fonts families with Devanagari (every one SIL OFL, checked against google-font-metadata 6.0.8 on 2026-10-28; the duplicate "Noto Sans" family is left out). All 61 install with both Devanagari and Latin files: 214 woff2 files, 9.8 MB in total. Being in the list means "can be tested", not "approved".

## Rule

A font may drive the live editor only if, on real copy:
1. line breaks match the browser on >= 99.5% of comparisons,
2. **0 overflows**: Pretext never fits more on a line than the browser does (that text would run past the column or into a photo in print), and
3. halant/conjunct checks are clean (widths 66/66, breaks >= 99%).

95-99.5%, or any overflow: preview only, server layout for final output. Below 95%: server layout only.
Early breaks (Pretext wraps a word sooner than the browser) are harmless in print, because export draws the engine's own lines (D-004): the line is one word looser, nothing more.
Parity says nothing about how a font looks in print; judge that on a proof.

## What Hindi papers actually use, and what that means here

Most Hindi dailies set their pages in proprietary house faces, or in legacy non-Unicode fonts (Kruti Dev, Chanakya) inside desktop layout software. Mangal and Kokila (Windows system fonts) are common on screen. None of these can be bundled: the house faces are not licensed to you, the legacy fonts are not Unicode (the Phase 1 converter turns their text into Unicode), and the Windows fonts may not be redistributed. The open fonts below cover the same jobs: a serif or sans for body, a bold condensed sans for headlines (the typical Hindi newspaper look), a heavy display face for mastheads and banners, and a handwriting face for school magazines.

Commercial Unicode fonts (Indian foundries) can be added later only with a licence that allows web use, embedding in generated PDFs, and distribution inside an app. Get that in writing before testing them.

## Measured so far (real Janshakti copy, 127 paragraphs, body sizes 12/14 px, weight 400)

| Font | Role | Match | Overflows | Verdict |
|---|---|---|---|---|
| Noto Serif Devanagari | text-serif, **launch** | 99.8% | 0 | PASS |
| Noto Sans Devanagari | text, **launch** | 99.7% | 0 | PASS |
| Rozha One | display | 99.9% | 0 | body sizes only, not tested as a display face |
| Khand, Eczar | headline | 99.7% | 0 | body sizes only, not tested as headlines |
| Kalam | handwritten | 99.6% | 0 | PASS at body sizes |

All 29 mismatches in that run were early breaks; there were no overflows. The earlier full runs (same copy, Devanagari + Latin bundled) also passed Sarala 99.8, Hind 99.6, Martel 99.6, Yantramanav 99.6 and Halant 99.5. Baloo 2 (99.4) and Mukta (99.1) were CAVEAT. Those runs predate the overflow count, so re-run them.

From a quick screen on invented text: **Tiro Devanagari Hindi** and **Vesper Libre** fail mostly by *overflowing*, which is the dangerous direction. Keep them out of the live editor until Phase 0 task 3 explains why.

The 32 families added on 2026-10-28 (Akshar, Anek Devanagari, Annapurna SIL, IBM Plex Sans Devanagari, Kadwa, Khula, Martel Sans, Poppins, Sahitya, Sarpanch, Tiro Devanagari Marathi/Sanskrit and others) are **untested**.

## Run it

Inside `spike/` (Git Bash):

```
node add-fonts.mjs                         # install every font in fonts.json (one-time; ~10 MB)
node run.mjs                               # GATE run: launch fonts, body sizes. Writes out/report.*
node run.mjs --all --quick                 # screen all 61 at body size (writes out/report-screen.*)
node run.mjs --roles text,text-serif       # every body font, full body test
node run.mjs --headline                    # headline, display and handwriting fonts at 20/28/36/48 px, bold, 140-480 px columns
node run.mjs --headline --fonts "Noto Sans Devanagari,Poppins"   # bold body sans used as headlines
node run.mjs --fonts "Halant,Hind"         # chosen fonts, full body test
node run.mjs --sizes 9,10,11 --weights 400,700 --widths 70,90   # captions and small print
node run.mjs ... --out headline-2026-10-30 # name the report instead of report-screen
```

Screening runs never overwrite `out/report.*`, the file G0.parity reads. Runs skip weights a font does not have (the `weights` field) instead of measuring a browser-faked bold. In each report, look at the **overflows** column first, then the match rate.

Then `cd .. && npm run harness -- --phase 0`.

## Choosing what to ship: test many, ship few

Every font in the picker costs the user. On a phone in Indore, each weight is 50-100 KB to download before the page looks right. Every extra name is also one more choice for an editor who just wants the page done (UX_SPEC: one obvious path). Suggested v1 picker, once each font passes its own role's test:

- Body: 3 or 4 (the two Noto launch fonts plus the best one or two of Sarala, Hind, Martel, Halant, Sahitya, Kadwa, Annapurna SIL).
- Headlines: 4 to 6 from the `--headline` run (Khand, Rajdhani, Teko, Sarpanch, Poppins, Akshar, bold Noto Sans).
- Display / masthead: 3 (Rozha One, Yatra One, Gajraj One, Modak, and so on).
- Handwriting (school magazines): 2 (Kalam, Playpen Sans Deva, Dekko).

Load picker fonts on demand; only the fonts a document uses are fetched and embedded. Every font a published page uses must have passed for the role it plays there.

## Add a font

1. Google Fonts: add a row to `spike/fonts.json`: `{ "name": "Exact Family Name", "pkg": "fontsource-id", "role": "text", "weights": [400, 700] }`, then `node add-fonts.mjs "Exact Family Name"` and `node run.mjs --fonts "Exact Family Name"` (add `--headline` for headline or display roles).
2. Not on Google Fonts: drop the .woff2 files (Devanagari and Latin, 400 and 700) into `public/fonts`, add an `@font-face` per file to `fonts.css` by hand, add the row to `fonts.json`, and keep the licence text in `public/fonts/licenses/`.
3. Changing `launch` flags changes the gate, so Amal approves it with `npm run approve`.

## Known limits

- Copy from one site, one browser engine (Chromium). A Windows run and a Linux run differed by one comparison in 5,082.
- Body runs test weight 400 only. `--headline` tests 700. Other weights (500, 600, 800) are not tested; add them with `--weights` if the picker will offer them.
- Justified text, right-side and mid-column photos, and sizes 9-11 px are Phase 0 task 4.
