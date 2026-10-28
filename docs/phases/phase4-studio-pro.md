# Phase 4 — Studio (Pro mode)

Read `CLAUDE.md` and `docs/PRODUCT_PROMPT.md` first. Spec: `docs/design/Studio.dc.html`, `docs/design/Main.dc.html`.

## Goal

For designers and larger papers: precise control, without making Easy mode heavier. Pro and Easy share the same document and ops; switching modes never loses anything.

## Tasks

1. **Rulers and guides.** Millimetre rulers (top, left), draggable guides, snap to column edges, baseline, margins, other objects. Toggle and tolerance setting.
2. **Selection model.** Click, shift-click, marquee, nudge 1 mm (Shift 5 mm), align and distribute, group and ungroup (`parentId`).
3. **Assets on assets.** Drop-zones ("यहाँ रखें") on photo, box, page; drag also works. Child moves and scales with parent. Visible in the layer tree with an "out" button.
4. **Layer tree.** Reorder, lock, hide, rename; wrap mode and offset per object; contour wrap from a cut-out alpha mask (polygon extraction from PNG alpha with simplification; cap vertex count; test with 20 cut-outs).
5. **Own fonts.** TTF/OTF upload with licence tick-box, shaping test (render Devanagari sample, flag fonts missing conjuncts), subset embed in PDF.
6. **Background upload.** Image upload with dpi check, fit/fill/tile/centre, margins only.
7. **Style roles.** Edit kicker/headline/deck/body/caption styles once, applied everywhere; per-article overrides tracked.
8. **Accessibility and mode switching (UX_SPEC §3, §10).** Pro is opt-in; switching modes never changes the document. Easy mode must stay uncluttered: nothing from Pro leaks into it.
8b. **Accessibility.** Keyboard-only path for every tool, visible focus, ARIA live status for ops, screen-reader labels in Hindi, high-contrast and large-text toggles. Axe clean.
9. **School magazine kit.** A4 templates: contents, principal's message, student bylines, poems, art page, awards. Plan Vidyalaya.

## Harness gates to activate

G4.a11y (axe: 0 serious violations on editor routes; scripted keyboard-only run completes "place photo, wrap text, export"), GX.perf (drag relayout < 8 ms/frame on a mid-range phone and laptop; record numbers).

## Done when

A designer reproduces a front page from the Aaj Tak/Free Press reference screenshots in Pro mode, Easy mode opens the same file unchanged, and `npm run harness -- --phase 4` passes.
