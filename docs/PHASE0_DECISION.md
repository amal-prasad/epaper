# Phase 0 decision (2026-10-30)

**GO: Pretext is the live engine** for the four launch fonts. The export route is chosen, but its implementation is not yet fit for press (see Export route). Numbers come from `npm run harness -- --phase 0 --done` on 2026-10-30, results in `spike/out/` and `harness/results/`. Every number uses an assumed grid (A3, 12 mm margins, 5 columns, 4 mm gutter, 9 pt body) until the printer's spec sheet arrives (GG-007).

## Gates

| Gate | Result | Threshold |
|---|---|---|
| G0.parity: body breaks vs browser, 127 real paragraphs, Noto Sans and Noto Serif Devanagari 400, 12/14 px | 3546/3556 (99.7%), 0 longer than browser | >= 95, 0 longer |
| G0.headline: weight 700, 18-36 px, 1-4 columns, 200 real headlines; Khand, Eczar, Noto Sans, Noto Serif | 12796/12800, 0 longer | >= 99.5, 0 longer |
| G0.flow: flow() contract and own tests | 22 | >= 17 |
| G0.speed: flow() on a full A3 page, 416 lines | median 4.1 ms on the final run (3.4-12.6 ms across today's harness runs) | <= 30 ms |
| G0.pdfpos: Chromium PDF vs flow() | left 0.009 pt, baseline spread 0, right p95 0.010 / worst 0.051 pt (raster), fonts 4/4 embedded and subset | <= 0.1 pt |
| G0.black: text and rules on K only | 1: Amal checked the separations, and on 2026-10-30 checked rewrite.pdf and gray.pdf in CorelDRAW (CMYK numbers preserved) | 1 |

Fonts approved: body Noto Sans Devanagari (99.7%) and Noto Serif Devanagari (99.8%); headline Khand and Eczar; Noto 700 for subheads and kickers. All four pass the halant width checks (66/66). All 112 characters of the real copy are in every launch font at 400 and 700.

Worst failures: all 14 mismatches break earlier than the browser; none overflows. Body example, Noto Sans 12 px in a 90 px column: browser `इंदौर में मंगलवार, 27`, Pretext `इंदौर में मंगलवार,`. Headlines: 3 of the 4 early breaks are on lines with Latin digits (`741`, `2047 तक`, `1.24 … पर`); the fourth is Noto Sans 24 px `निकायों की खरीद पर`.

What the gates do not cover is listed in `docs/GATE_GAPS.md` (GG-028 to GG-039 come from the phase-end audit). The largest uncovered areas:
- Gate copy has no em dashes, curly double quotes, URLs or ZWJ (GG-032).
- Body is measured only at 12/14 px (GG-031).
- G0.parity's threshold of 95 sits below the 99.5 GO bar (GG-028).

## Export route

Engine lines drawn absolutely, then a Chromium PDF, then Ghostscript (D-004).
- **Colour pages:** rewrite neutral RGB to K-only CMYK, then convert to CMYK.
- **Mono pages:** Gray.
- **Rejected:** plain CMYK (puts black on four plates) and `-dBlackText -dBlackVector` (blackens colour text and solid tints).

The reviewer (rule 16) found the route right but the spike not fit for press. Conditions for the Phase 1 export:
1. Rewrite the content streams with a real PDF tool. The regex breaks the xref, and Ghostscript repairs it silently (GG-033).
2. Fail the export on any Ghostscript warning, and on any non-CMYK neutral left over (GG-034).
3. Run a per-export plate check that includes tone (`docs/proposals/export-k-plate-check.md`, GG-025).
4. Map tints through the printer's K curve (GG-035). Keep white out of the rewrite (GG-036).
5. Set photo quality and downsampling explicitly (GG-037).
6. Output PDF/X with an output intent, TrimBox and bleed (GG-040).

G0.black rests on on-screen separations. A physical proof is needed before the route is final; it moves to Phase 1 as G2.proof (Amal to accept).

## Printer questions (E1)

1. **ICC profile.** With the default profile the test photo reaches 296% ink, and 15% of it is over 260%.
2. **Ink limit** for newsprint.
3. **Overprint or knockout** for black over photos and colour (all routes knock out; GG-027).
4. **Trim size, margins, columns, gutter, bleed, crop marks.** All gates must be rerun on the real grid.

## What Pretext does not do (we build it)

Selection and cursors, rich text (bold or italic inside a paragraph), the threading UI, a hyphenation policy, widow and orphan control, paragraph breaks in flow() (GG-016, visible in `spike/out/flow.png`), and justification. Today's justification is greedy word space only; the cheap-lever experiment (D-030) is waiting for Amal's eye.

## Moves to Phase 1

- Export module with the six conditions above, plus the export-time overflow check.
- Merge or drop the flow-dead-gaps branch (`scripts/preview.mjs` lives only there).
- GG-015 (rebuild a real past issue), GG-019, GG-025, GG-033 to GG-038, GG-040.

Phase 1 estimate: about 19 working days, the plan's 135 h at 7 h a day. On top of that, about 3 days for export conditions 1, 2 and 6. Both are estimates, not measurements.
