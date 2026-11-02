# Golden page preparation

The standalone tools prepare `G1.golden`; they do not activate the pending gate, change judges, approve generated images or write hand-measured results. Ten synthetic candidates in `demos/golden-pages.html` need human visual review. The current gallery links to `demos/golden-pages-v2/`; the earlier sparse candidate directory is retained as an unapproved authoring artifact. Rendering something successfully does not establish that the page is correct.

Run from the repository root, using installed dependencies and bundled fonts:

```bash
node --test packages/export/test/golden.test.js
node scripts/golden-pages.mjs demos/golden-pages-new
node scripts/demo-golden-pages.mjs demos/golden-pages-new
node scripts/golden-compare.mjs demos/golden-pages-new/manifest.json REVIEWED_BASELINE/manifest.json demos/golden-diff
```

Candidate generation requires a new directory and refuses an existing directory, protecting reviewed baseline assets. A failed run can leave a partial candidate directory without a manifest; use a new destination after fixing the error. The demo command writes the review gallery, opens it in Chromium, decodes all images and fails on console/page errors. The parent integration lists it in the shared demo index.

## Fixtures and evidence

`scripts/golden-pages.mjs` binds explicit owned copy and programmatically drawn artwork to ten existing templates: weekly-front, front-hero, front-rail, weekly-inner, inner-center, inner-cutout, inner-halfad, inner-hero, weekly-back and ads-classified. Nine retain the assumed 297 × 420 mm preset; inner-hero uses an explicit 250 × 380 mm override. Body fonts include bundled Noto Sans and Noto Serif Devanagari; headlines use Khand. Round, central and cut-out obstacles, narrow rails, a hero, a half-page ad, classifieds and the last-page imprint are represented. No production identity or third-party content is invented. The inner and back pages contain denser, frozen synthetic copy calibrated with bundled-font measurements: 117 and 102 body lines respectively, including text ending within one line of frame bottoms. Other layouts retain moderate copy. This is a regression corpus, not production-layout acceptance.

Each fixture renders twice through `renderIssue` using the real engine and bundled fonts. Exact decoded screenshot pixels must match before the candidate manifest is written. The manifest records source JSON/image SHA-256 hashes, template hashes, renderer/generator hashes, Chromium/Node/Playwright/canvas versions, platform, launch arguments, font CSS/ink metadata and every used font-file hash. PDFs are provided for human inspection; PDF byte equality is not used because metadata can vary. Source hashes are informational; fixture and image hashes are enforced, and environment/font/tool provenance must match.

Three real document mutations are rendered through the exporter and compared using the same raster comparator: shortened headline, 1 mm frame movement and a body-font change. They must be rejected. Unit tests additionally delete a single pixel from a one-pixel rule, change colour by one channel value, shift geometry, change dimensions, remove baseline review, corrupt asset hashes and omit pages. Exact per-pixel comparison has no page-wide threshold that can dilute a small Hindi matra or thin-rule defect. Reports include the changed-pixel count and smallest enclosing defect rectangle; optional difference images mark changed pixels in red.

## Human review and baseline custody

1. Open the gallery and inspect all ten full-size PNGs and intermediate PDFs. Check headlines, matras, captions, reading order, wraps, images, ad geometry, print line and margins. Request corrections before accepting.
2. The human reviewer copies the complete reviewed candidate directory to a separate baseline directory. Preserve every image/fixture hash in the copied manifest. Set its `status` to `human-reviewed` and add a `review` object with nonempty `by`, `at` and `note` strings describing the actual review. No generator or approval command performs this step. This metadata records the review; it does not cryptographically authenticate the reviewer.
3. Generate future candidates into a fresh directory and run the comparison command against that reviewed manifest. The CLI requires exactly ten pages. Missing baseline, unreviewed status, missing provenance, changed environment/fonts, duplicate/missing/reordered pages, invalid asset paths, content changes or mismatched recorded asset hashes fail clearly. Image differences exit with status 1 and a detailed JSON report.
4. A legitimate fixture, font, platform or tool-version change needs another visual review and a separately stored baseline. Never update the reviewed directory in a regeneration script. Gate activation/approval remains the user's existing process.

## Limits and pipeline risk sweep

These are intermediate RGB screen screenshots at 96 dpi, with PDFs supplied for review. They do not exercise the complete final CMYK/Gray route, independent PDF/X conformance, printer proof or high-resolution raster defects. They also do not certify that Hindi copy has correct meaning or that arbitrary layout inputs work. Exact comparison is intentionally strict and environment-specific; cross-platform antialiasing changes require review, not a looser threshold.

Input/paste, editing, e-paper and source-asset backup behavior are unchanged. Layout/export now have candidate repeatability and defect-sensitivity evidence, but ten accepted human-reviewed baselines remain absent. Print/physical-proof and independent PDF/X evidence remain separate. Proposed risk for the shared gap log: a screen-only golden corpus could miss final PDF raster or colour-conversion defects; retain those checks separately and do not treat this preparation as their replacement. Two denser fixtures exercise multiple near-full columns; this still does not establish correctness for every production layout. The read-only `node scripts/golden-density.mjs` authoring aid measures capacity without editing fixtures, baselines or user copy.
