# Local export runbook

## Phase 1 preparation tools

The local export route below also supports the new review workflows:

- [Golden pages](golden-pages.md): ten deterministic candidate pages, repeat-render checks and deliberate visual defects. Open `demos/golden-pages.html`; candidates require human review before becoming baselines. Screen goldens do not certify final colour PDF output.
- [Auto-page v0](autopage.md): additive placement proposals through existing reversible operations. Open `demos/autopage.html`. Existing placements and locks remain unchanged; unresolved overflow and missing continuation support remain explicit.
- [Production measurements](production-log.md): append actual issue measurements with `node scripts/production-log.mjs append ISSUE.json`, then inspect `node scripts/production-log.mjs summary`. The local ledger never writes harness results. Synthetic demo records never qualify.

Keep `.local/production/`, original measurement notes, accepted baseline directories, issue JSON, assets and fonts in the off-machine backup. None of these new tools establishes that second-machine recovery has been tested.

## Current implementation

`packages/export` resolves publication/output settings, renders document JSON through the existing Hindi engine, and runs the established neutral-to-K colour or Gray route from `scripts/black-spike.mjs`. The original experiment is unchanged. The reusable exporter uses structured pikepdf editing rather than the experiment's raw-byte rewrite, then Ghostscript conversion and final-file checks. Output is labelled **checked development output**; independent PDF/X certification and physical press acceptance are not claimed.

Requirements: the repository's Node workspace dependencies, dependencies in `spike/` (esbuild, pdfjs-dist and canvas), bundled `spike/public/fonts.css` and its font files, `fonts/ink.json`, Playwright Chromium, Ghostscript and Python with pikepdf. Install using the project's existing Node setup instructions on a new machine; do not substitute system fonts. Install the isolated Python dependencies from the repository root with `python -m pip install --target .local/export-python -r packages/export/requirements.txt`. This does not replace the global Python environment. `qrcode` in that file is for generating the synthetic QR fixture only; its payload is our own test string and the matrix is drawn as vector modules with a quiet zone.

From the repository root:

- `node --test packages/export/test/settings.test.js packages/export/test/render.test.js packages/export/test/colour.test.js packages/export/test/export.test.js` checks settings, real Chromium rendering, structured colour operations and assembled export.
- `node scripts/demo-press-export.mjs` writes two synthetic fixture documents, intermediate PDFs and screen/PDF rasters under `demos/press-export/`, plus `demos/press-export.html`. It opens the demo in headless Chromium and rejects console errors.
- `node scripts/demo-converted-export.mjs` builds two-page colour and mono issues from those fixtures, writes complete version bundles under `demos/converted-export/runs/`, and shows final C/M/Y/K plate images in `demos/converted-export.html`. It also checks that the demo loads without console errors.
- `node scripts/export-issue.mjs ISSUE.json --out NEW_DIRECTORY --profile presets/output/development-colour.json` exports a local issue. The mono counterpart is `development-mono.json`. Paths in the issue resolve relative to the issue file; ICC paths in the selected profile resolve relative to that profile file.
- `npm run demos` links the task from the demo index and refreshes the existing gate overview.

Use a new output directory for each export version. The exporter writes into a private sibling temporary directory, performs every implemented check, then atomically renames the complete directory into place. Existing directories are refused rather than overwritten, so a failure cannot damage the prior successful version. On failure the command exits non-zero and removes its temporary directory. Each successful bundle contains `issue.pdf`, the source issue, intermediate processing files, `report.json`, the exact ICC file used, screen/mask images and compact plate PNGs. Uncompressed TIFF scratch files are removed before publication.

Resolved settings, tool versions, source/output hashes, ICC identity, geometry, font embedding/subsetting, output-intent metadata, ink limits and per-region neutral checks are recorded in the report. The regional check uses 192 dpi masks and separations, requires visible coverage for every declared neutral line/fill, and allows at most 0.5% failed samples in each region. It checks intended paint tones rather than treating antialias shades as separate tints. A raster-only ad explicitly has no vector-neutral targets and skips that subcheck while retaining final colour/ink validation. These checks do not inspect black lettering baked into colour artwork as if it were document text.

Publication `preset.exportProfile` values still override reusable profile defaults. For example, a document explicitly set to the colour route must be changed or left unresolved before a mono profile applies; the demo uses an unresolved route so each selected profile can supply it. Zero bleed and crop marks off are the currently supported working assumptions. Other values, custom mono tint curves, overprint and unsupported vector colour constructs fail explicitly.

The provisional profiles target PDF/X-3:2002, matching the installed Ghostscript integration. The exporter checks the target identifier, profile hash and output intent, and refuses any Ghostscript diagnostic or fallback. It does not claim independent standards conformance: reports retain `independent-validation-pending`, and press mode refuses to manufacture certification. PDF/X-1a is not implemented by this integration. References: [Ghostscript's PDF/X output documentation](https://ghostscript.readthedocs.io/en/gs10.04.0/VectorDevices.html), [pikepdf content-stream parsing](https://pikepdf.readthedocs.io/en/latest/api/filters.html). A different supported output target can be added later without tying publication layout to a single press.

The public module is `packages/export/src/index.js`. `resolveExportSettings(preset, outputProfile, options)` returns an independent, serializable settings snapshot. Non-null publication settings override reusable profile defaults; `0` and `false` remain meaningful. Development settings allow recorded assumptions. `exportIssue(document, outputProfile, destination, options)` performs the assembled development export. The selected/default ICC profile is recorded as assumed until confirmed for the publication.

`renderIssue(document, { assetRoot, minImageDpi })` remains available separately for previews and returns intermediate RGB PDF bytes, positioned engine lines, screenshots and high-resolution neutral masks. It never changes the source issue. A bundle's source JSON does not automatically archive externally referenced images or font files; keep those source assets in the backup as well.

## Document requirements and supported scope

Geometry is in millimetres; font sizes and line heights in `style` are CSS pixels. Each placed story has a plain-string paragraph array. Frames reference a story and provide valid `cols` and `gutter`. Text objects (`label`, `quote`, text-only `ad`) provide explicit `text`; the exporter does not invent template placeholders or silently choose publication details. A literal square-bracket string requires the source object's/story's explicit `literalBrackets: true` resolution.

Supported drawable objects: labels, quotes, text/image ads, raster photos, boxes and filled rules. PNG, JPEG and WebP assets can be local files or embedded data URLs. An `assetId` resolves through the document's `assets` list using its `path`. Remote fetches are disabled. Font families must exist in the bundled CSS and ink metadata. Every story must be placed; the exporter refuses unplaced copy, overflow, unknown objects, missing/low-resolution assets and invalid geometry.

Known boundaries: frame chains and rotations are refused explicitly. Rich paragraph objects, automatic template furniture binding, paragraph spacing, mixed styles within a paragraph, nonzero bleed/crop-mark rendering and QR decoding are not implemented. The existing layout engine joins body paragraphs for flow; this is not a new rich-text implementation. Unsupported vector ICC/pattern/shading/transparency constructions are refused rather than silently missing neutral text. Colour photos remain handled by Ghostscript's image conversion.

## Recovery and production status

Keep issue JSON, font files, source images and resolved settings together in the backup. Regenerate the intermediate file from those inputs; never recover the source text from an exported PDF. Run the focused tests and demo on the second machine and compare the same fixtures before relying on it. A second-machine recovery has not been performed in this task.

No physical proof, universal press compatibility, independent PDF/X certification or Phase 1 completion is claimed by these development artifacts. Use the report to review actual checks and assumptions before validating a publication's production configuration.
