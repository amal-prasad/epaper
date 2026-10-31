# Proposal: K-only plate check on every export (GG-025)

Status: proposal, not wired in. Amal decides whether it becomes an export step and a Phase 1 gate.

## Problem
The colour export route rewrites neutral RGB (`a a a rg/RG`) to K-only CMYK before Ghostscript converts the page (scripts/black-spike.mjs, G0.black). It relies on how Chromium writes colour today: 2 x `0 0 0 rg`, no `sc/scn`. If a Chromium update writes black another way (ICC colour space, pattern, Form XObject), the rewrite misses without any error. Black text then prints on four plates and blurs on any misregistration. G0.black was measured once, on one test page.

## Check
After the press PDF is written, before it is handed to the printer:
1. Separate each page with Ghostscript: `tiffsep -r150 -sCompression=none`.
2. Take the regions from the document, not from the PDF: every body and headline line box flow() placed with black text, every rule, every neutral tint box. Colour regions (photos, coloured text and boxes) are skipped.
3. In each black region, count inked pixels (C+M+Y+K > 12 of 255) that also carry C, M or Y > 6. The same thresholds as black-spike.mjs.
4. Fail the export if any black region has more than 0.5% such pixels. Name the page, the region (story id, line number) and the plates involved.

Mono pages (Gray route) need only a cheaper check: the PDF must hold no CMYK or RGB colour at all.

## Cost
tiffsep on the A3 test page: 435 ms at 150 dpi, 548 ms at 200 dpi (Ghostscript 10.04, this laptop, 2026-10-30). The region scan is a loop over the page's line boxes, well under that. About 5 s for an 8-page issue.

## Code
Lift `readTiff` and the region loop out of scripts/black-spike.mjs into the Phase 1 export module, fed with the layout's line boxes. No new dependency: Ghostscript is already required for the CMYK conversion.

## Gate shape (Phase 1, if accepted)
G1.kplate: every page of the export test issue passes the check (0 failing regions). Negative control: export once with the rewrite step switched off; the check must fail on every page with black text.

## Open
- The 0.5% tolerance covers anti-aliased edges at 150 dpi; set it from a run on a real issue.
- Knockout vs overprint (GG-027): if black is set to overprint, the CMY under the text is wanted ink. The check then has to read overprint from the PDF instead of the plates, or look only at the text strokes (K at least 230).
