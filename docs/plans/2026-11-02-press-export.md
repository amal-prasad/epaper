# Press Export Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Do not execute until Amal resumes implementation.

**Goal:** Build configurable newspaper PDF export for publications across India, using explicit working assumptions to make progress in this phase and publication-specific production validation later.

**Architecture:** Keep the engine pure and DOM-free. A separate local export package renders the engine's positioned lines with bundled fonts in Chromium, processes the PDF with a PDF-aware tool and Ghostscript, and validates the final file before publishing it as press-ready.

**Tech Stack:** Existing JavaScript npm workspace, Playwright Chromium, Ghostscript; PDF editing and PDF/X validation tools to be selected through a small feasibility check.

**Status:** Execution authorized on 2026-11-02. Amal selected `scripts/black-spike.mjs` as the work to reuse. Its colour/Gray strategies are integrated with configurable settings, the shared renderer, structured PDF rewriting, final geometry/font/colour/ink/neutral-region checks and atomic version-bundle publication. See `docs/RUNBOOK.md`, `demos/press-export.html` and `demos/converted-export.html`. Provisional PDF/X-3 target metadata/output intent are checked; independent conformance validation and physical proof remain pending. Zero bleed/crop marks off are supported now; unsupported alternatives fail explicitly. This is a development milestone, not Phase 1 completion.

**Direction clarified on 2026-11-02:** The intended market is many newspapers and presses across the country. Janshakti is an initial example, not the product's configuration boundary. In this phase, choose reasonable, editable defaults and record assumptions; do not wait for one printer's sheet or treat every unanswered production question as a development blocker. Apply stricter publication-specific checks when preparing actual production output. This clarification supersedes the earlier single-printer framing of this plan; existing recorded gates remain unchanged.

## Reference and scope

The reference is the Dainik Bhaskar front-page image supplied in the conversation on 2026-11-02: orange masthead, red edition strip, dense Hindi news above a large furniture advertisement, narrow left-side modules, coloured labels, photographs, rules, and QR codes.

Use its composition and print stresses as a reference. Do not infer physical dimensions, font identities, ICC profile, or ink limits from a screenshot. Do not ship its stories, masthead, photographs, QR payloads, or advertising artwork as product assets. Build the export fixture from owned or synthetic content with known licences. The temporary clipboard path is not a durable project asset.

For export coverage, make a representative page using an existing six-column template: Hindi headline and body, caption, photo, vector rule, neutral tint, coloured label, QR code, a large ad, and a publication imprint. This is an export fixture, not a promise to reproduce every design detail. Existing templates cannot yet express every part of the reference; add missing export primitives only where needed, and leave broader template redesign to its separate Phase 1 task.

Research inputs: `demos/paper-sizes.html` and `docs/PAPER_SIZES.md`. Use their suggestions and source-quality notes to select provisional profiles. They are not confirmed specifications for every press. No new web research is claimed by this plan.

## Settings contract

Read settings from the document's preset (`packages/engine/src/preset.js`, `presets/`) rather than hardcoding a newspaper size. Separate publication layout settings from reusable press/output profiles; save their resolved values with each issue so later changes do not alter old issues. Profiles must be editable and support multiple publications and presses. Keep the current assumed A3, six-column configuration as the initial development fixture, not a national standard. No preset changes during planning.

| Setting | Current position | Press-export requirement |
|---|---|---|
| Trim size, margins, columns, gutter | Assumed grid | Explicit confirmed publication values; validate layout geometry |
| Bleed and crop marks | Research cannot confirm them | Explicit values; zero bleed and false crop marks are valid |
| Colour route and per-page colour/mono mode | Route chosen in Phase 0; page-mode representation needs inspection | Explicit mode for each page and supported conversion route |
| PDF/X standard | Not confirmed | Explicit supported target, with independent validation |
| ICC profile/output intent | Not confirmed | Available profile matching the selected route and target |
| Total ink limit | Research suggestions only | Explicit printer-approved value; measure finished output |
| Neutral tint curve and overprint/knockout policy | Unresolved | Explicit policy before colour-page acceptance |
| Image resolution, compression, downsampling | Not set for production | Explicit policy, including minimum effective resolution and QR preservation |
| Publication imprint | Placeholder fields in demos | Actual publication settings; no unresolved required fields |

The table describes production requirements, not prerequisites for starting development. Validate the complete export contract separately from the engine's permissive preset validation. In this phase, populate unknown settings from a named provisional profile and list the assumptions in the report; do not reject a development export simply because a value lacks printer confirmation. Reject technically unusable settings such as invalid dimensions, a missing profile file required for conversion, or an unsupported conversion target. Keep successful technical validation distinct from physical press acceptance.

Initial working assumptions: existing A3/six-column fixture, colour and mono sample pages, zero bleed, crop marks off, knockout black, and a provisional PDF/X-1a target. Evaluate a newspaper ICC profile from the existing research and use 240% as a provisional ink-limit test value; neither is a claim about all Indian presses. Record exact profile identity and supported conversion details once the tools are selected. Use synthetic publication details and assets for fixtures. Revise these defaults when evidence warrants it, without redesigning the engine or blocking unrelated development.

Exercise at least two page sizes and two output-profile configurations through simple export fixtures to catch hidden coupling. Existing templates support only six columns; alternate-grid fixtures can use explicit frames until template generalisation is built. Supporting other sizes must not mean scaling a finished page image and its text indiscriminately.

## Export pipeline and failures

1. Validate document, page-count rule, assets, imprint, export settings, and all outstanding story remainders. Never trim overflow silently. Scan text from document/render data, not extracted PDF text, for unresolved placeholders. Preserve legitimate square-bracket text through an explicit resolution policy rather than deleting it.
2. Resolve bundled font files and assets; wait for font and image loading. Render the engine's existing line positions and word spacing without allowing browser paragraph reflow. Launch Chromium with `--font-render-hinting=none` (D-055/D-056). Preserve geometry in millimetres, converted consistently at the rendering boundary.
3. Check every rendered text run against its assigned frame, including headline ink. Reject overflow with page, story/frame identifier, and line location. Verify assets and QR quiet zones at final placement size.
4. Generate the intermediate Chromium PDF. For colour pages, rewrite designated neutral text/rules/tints to K using a PDF-aware library/tool, including nested content and resources; retain colour objects and preserve white. Never reuse the regex rewrite in `scripts/black-spike.mjs` as production code.
5. Convert through the selected Ghostscript route: colour conversion with the chosen output profile, or the chosen mono route. Set image quality explicitly. Preserve required PDF structure and boxes. Treat warnings, repair messages, missing resources, and non-zero process exits as failures; capture diagnostics.
6. Validate the final PDF: selected PDF/X conformance and output intent, correct page count and page boxes, fonts embedded/subset, positional fidelity, colour policy, total ink limit, and image quality. An output intent alone is not proof of PDF/X compliance.
7. Check final separations. Black text/rules must stay on K under the selected knockout/overprint policy; neutral tints must retain their intended tone. Coloured headings, photographs, and ads must retain colour. For mono pages, check the final file against the explicitly selected mono/PDF-X colour-space policy.
8. Write a report with input identity, settings, font/tool versions, output hash, checks, warnings, and failures. Produce in a temporary directory and promote atomically only after every required check passes. A failed export must leave the previous successful PDF untouched and return a non-zero exit status.

`docs/proposals/export-k-plate-check.md` is a starting proposal, not an approved gate. Its tolerances need calibration. A page-region plate scan is insufficient where black text overlaps coloured backgrounds; distinguish text ink from intentional underlying colour and account for overprint. Do not simply exempt all overlapping text from verification.

## Implementation sequence for the later session

### Task 1: Confirm tools and export contract

Inspect `scripts/measure-export.mjs`, `scripts/black-spike.mjs`, `scripts/demo-templates.mjs`, `packages/engine/src/{doc,preset,flow,headline,templates}.js`, and current dependency licences. Select the PDF-aware editing tool and an independent validator for the exact PDF/X target. Document supported colour/mono combinations and unresolved printer fields before committing to dependencies. If no suitable validator is available, report that gap rather than claiming PDF/X compliance.

Proposed files: `packages/export/package.json`, `packages/export/src/settings.js`, `packages/export/test/settings.test.js`. Match existing workspace conventions and approval rules before adding scripts.

Test first: missing/null fields, zero bleed, false crop marks, assumed fields, missing ICC file, invalid dimensions, unsupported targets and page modes. Run the focused test and observe failure before implementing validation; rerun to confirm the intended behaviour.

### Task 2: Reference fixture and positioned rendering

Proposed files: `packages/export/src/render.js`, `packages/export/test/render.test.js`, `packages/export/test/fixtures/reference-issue.json`, and licensed/synthetic fixture assets beside it.

Build the representative page above. Test conservation, exact positioned-line use, missing fonts/images, headline clipping and body overflow. Include Hindi conjuncts, matras, punctuation, numbers and mixed Latin text. Compare screen and PDF output by raster and coordinates; extracted PDF text alone is unreliable for Devanagari. Add a deliberately shifted line and verify the position check catches it.

### Task 3: PDF processing and colour correctness

Proposed files: `packages/export/src/pdf.js`, `packages/export/src/convert.js`, `packages/export/test/colour.test.js`.

Implement the selected structured rewrite and conversion. Test neutral fills/strokes, nested Form XObjects, ICC-based colour, supported transparency, white, and coloured text. Unsupported constructs must fail explicitly. Inject a conversion warning and verify refusal. Verify K-only text, tone preservation, colour retention, and final total-ink limits on the representative page.

### Task 4: Final validation and local command

Proposed files: `packages/export/src/{validate,report,index}.js`, `packages/export/test/export.test.js`, `scripts/export-issue.mjs`.

Add a local command that takes an issue path and output location. Test the complete pipeline, including incorrect page boxes, missing fonts/output intent, validator failure, invalid page count, placeholders, remainder text, poor image resolution, excessive ink, and output promotion failure. Confirm each faulty input is rejected and a previous good PDF survives. Include a negative control with neutral rewriting disabled.

### Task 5: Review, demo, and printer proof

Create `demos/press-export.html` with screen/PDF comparisons, separations, settings, unresolved items, and actual check results. Register it in `demos/tasks.json`, rebuild the index, and inspect it in Chromium for console errors. Update `docs/RUNBOOK.md` with exact dependencies and export/recovery instructions. Perform the required independent print-output review before calling the work ready for physical proof.

Run the commands below and report their actual results. Existing test/judge changes require Amal's own approval command; never modify locks or thresholds to bypass review. Amend `harness/gates.json` only after Amal accepts a concrete gate proposal.

Later, validate output with actual publications and their presses, beginning with any practical pilot, including Janshakti. Printer feedback refines profiles; a single accepted proof does not establish compatibility with every press. Only Amal records G2.proof and production-time results. Unknown press specifications do not block building or demonstrating export with the provisional profiles.

## Verification and completion criteria

Commands for the implementation session, to name before coding:

- Focused tests: `node --test packages/export/test/*.test.js` (use explicit paths if the shell does not expand the pattern).
- Regression tests: `npm test`.
- Established foundation: `npm run harness -- --phase 0 --done`.
- Current phase: `npm run harness -- --phase 1`; pending gates do not establish phase completion.
- Phase exit, only after the remaining Phase 1 work: `npm run harness -- --phase 1 --done`.
- Demo index: `npm run demos`.
- After source changes: `graphify update .`.

These commands have not been run for this planning task. Proposed export tests and commands do not exist yet. No performance number, tolerance calibration, printer approval, or successful PDF/X export is claimed.

The export development milestone is reached when repeatable checks pass on the representative page, a multi-page issue, and the alternate size/profile fixtures, with assumptions and limitations reported and print risks reviewed independently. Production acceptance is a separate milestone for each publication/press configuration. Overall Phase 1 still follows its existing recorded gates and metrics; this plan does not silently remove or approve them.

## Risk sweep and boundaries

Carry forward the existing export risks in `docs/GATE_GAPS.md`: unknown printer settings, four-colour black, tint damage, PDF repair, total ink, placeholders, cross-platform font positioning, and six-column-only templates. Input/paste, layout, editing, e-paper and backups remain in their existing Phase 1 scopes. Preserve source documents and assets; build e-paper from document HTML, never extracted PDF text. No new implementation risk is introduced by this planning-only change.

Remaining beyond the development milestone: independent PDF/X conformance validation, physical proof, nonzero bleed/crop marks, broader template furniture binding and layout features, full reference-page redesign, submission API, Supabase, self-service and English support. The synthetic QR fixture is generated and exported as vector modules; QR decoding is not yet verified automatically. Input and external source assets still need the planned backup workflow.
