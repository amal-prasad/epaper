# Phase 2 — Press quality, e-paper publish, and money

Read `CLAUDE.md` and `docs/PRODUCT_PROMPT.md` first.

## Entry condition (hard)

Three weeklies have agreed in writing (WhatsApp message is fine, saved to `docs/PARTNERS.md`) to pay the planned price once this phase ships. If not, stop and do sales work instead of building.

## Goal

The same layout that previews on screen exports a PDF the printer accepts, publishes as an e-paper with clickable articles, and the customer can pay by UPI.

## Specs

`Main.dc.html` (preflight chip, export buttons), `Phone.dc.html`, `MobilePlans.dc.html`, `Compare.dc.html` (promises we must keep). Gaps 5, 6, 7, 8 and 9 in `docs/PRODUCT_PROMPT.md` §5.1 must be designed before building (write to `docs/DESIGN_GAPS.md`, wait for approved mockups).

## Tasks

1. **Printer spec.** Get the sheet from Janshakti's printer: trim size, bleed, ink limit, ICC profile, PDF version. Record in `docs/PRINTER_SPEC.md`. Do not guess.
2. **Export service.** `services/export`: container with headless Chromium and Ghostscript. Input: issue JSON + fonts + assets. Output per page: press PDF (CMYK, ICC, bleed, crop marks, fonts embedded, PDF/X), mobile PDF (RGB, 150 dpi), page images (WebP, 2 sizes). Lines drawn absolutely from the engine; `word-spacing` for justification.
3. **Preflight.** Rules as pure functions in `packages/engine`: image dpi under target, missing or non-embedded font, overflow, empty frame, text over dark background, ink limit, objects outside bleed, tiny text, unlinked story, RGB image in press PDF. Each rule returns a fix-link (jump to block). Seeded-fault corpus of 10 broken pages for the gate. Also a script gate on every exported press PDF: fonts embedded, black text is K-only (no four-colour black), no stray RGB, bleed present, page size correct. Run it in CI, not by eye.
4. **E-paper publish.** Hosted reader (reuse the `janshakti-epaper` PWA if the article-map shape fits; otherwise a new reader). Article map from the layout: `story_id -> rects per page`. Per-article share card (image + headline + link) and WhatsApp share link. Archive page.
5. **Phone mode (UX_SPEC §5 F7, §12).** One slot per screen, thumb-reachable controls, camera and gallery, browser-side image compression with progress and cancel, offline drafts, and plain-language fit and resolution warnings. Run the phone usability task T9 with 3 reporters.
5b. **Payment UX.** Show the price before any payment, "first 4 editions free", UPI with a clear receipt, cancel in two taps (UX_SPEC §13).
5c. **Phone mode details.** Slot-filling UI from `Phone.dc.html`: choose slot, camera/gallery photo, dpi warning, fit warning, send overflow to page N. Works offline for drafting; sync on reconnect.
6. **WhatsApp intake.** Reporter sends text and photos to a business number; stories land in the desk as drafts. Use the official WhatsApp Business API provider; record cost per message in the decision log.
7. **Billing.** Razorpay UPI: plans from `MobilePlans.dc.html`, first 4 editions free, watermark rules, usage metering, invoices with GST. Webhook-verified; no client-side trust.
8. **Ads.** Ad slots with sizes, booking link, proof to the advertiser, simple revenue report. Greetings and public-notice templates from the Assets board tagged Revenue.
9. **Approval.** Proof link (read-only), comment on a block, approve page, audit of who changed what.

## Harness gates to activate

G2.pdfx (valid PDF/X, fonts embedded, CMYK only), G2.preflight (>= 9/10 seeded faults caught, 0 false alarms on goldens), G2.proof (printer accepts a real proof: 1), plus GX.perf export time per page and per issue (record; set threshold with the first measurement).

## Done when

A real Janshakti issue goes to press from this app, readers open the e-paper and share an article card on WhatsApp, one customer has paid by UPI, and `npm run harness -- --phase 2` passes.
