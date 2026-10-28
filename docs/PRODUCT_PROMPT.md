# Hindi Page-Layout Studio — Master Product Prompt

Self-contained. Read this, then `CLAUDE.md`, then the phase file you are on (`docs/phases/`). Do one phase at a time. Do not start a phase until `npm run harness -- --phase <previous>` passes.

Working product name: **Studio** (placeholder, set in `packages/engine/src/config.js` as `PRODUCT_NAME`). Do not use "Patrika" anywhere: it is Rajasthan Patrika's name. The design mockups still say it; replace in code, never copy it.

---

## 1. What we are building

A web app (installable PWA, phone-friendly) that lets a small Hindi publisher build a printable newspaper or school magazine, and publish the same issue as an e-paper, without a DTP operator.

First customer and test bed: **Janshakti Ujala** (weekly, Indore; existing site on Next.js 14 + Supabase + Tailwind; existing `janshakti-epaper` PWA on Firebase). Then other small Hindi weeklies in MP, then school magazines.

Who pays and why, in one line each:
- Weekly owner: replaces ₹10k–40k/month of operator time with a tool that builds the issue from their own stories in under an hour.
- Printer / press: gets a CMYK PDF that passes preflight, with fewer reprints.
- Reader: gets a clickable e-paper and a WhatsApp card per article, from the same layout.

Target pricing (to validate, not to assume): Saptahik ₹7,999/yr or ₹149/edition; Dainik ₹24,999/yr; Press/Agency ₹59,999/yr; Vidyalaya ₹4,999/yr; phone: ₹15 per e-paper PDF, ₹99/month unlimited, Press Pro ₹799/month; first 4 editions free.

### Positioning (the product decisions follow from this)

We do not compete as a general design tool (Canva, Affinity, InDesign win that). We compete on **operator-hours saved**: the machine builds the page from the owner's own stories; the human approves and adjusts. The editor exists to fix what auto-page got wrong, not to be a blank canvas.

### Content decision (D-009)

XLR8 Print advertises "400+ news sources" with auto-selection and de-duplication. We match the **convenience**, not the sourcing. v1 content comes from: the customer's own stories (typed, pasted, own-website import), a **lead radar** (headlines and links from a paid news API shown as story tips; reporters write their own version), and de-duplication and priority sorting across everything in the desk. Every story carries `source` and `licence`, and a story without them cannot be approved. An opt-in sharing pool and licensed agency feeds are a later paid add-on, built only after 3 of 5 buyers say they would pay and an agency quote makes the margin work. No scraping, no AI rewrite of other publishers' copy. Get one hour of advice from an Indian media/IP lawyer before any content feature ships.

Therefore: **every editing operation must also be callable by the auto-pager.** If a button in the UI does something the auto-pager cannot, it is a bug in the architecture.

---

## 2. Non-negotiables

1. **The document is data.** One versioned JSON document describes an issue. UI, auto-pager, phone mode, PDF export and e-paper publishing all read and write it through operations. No state lives only in the DOM.
2. **One layout engine.** `packages/engine` turns (stories, frames, obstacles, styles) into positioned lines. Editor preview, e-paper, article map and PDF export all draw those same lines. Preview must equal export.
3. **Engine is pure and DOM-free.** No `document`, no `window`. It may use canvas measurement through an injected adapter so it can run in a Web Worker and in tests.
4. **Hindi first.** Devanagari conjuncts, matras, shirorekha, Hindi numerals option, Vikram Samvat date option, Kruti Dev / Chanakya to Unicode on paste. Justify by stretching word spaces only, never letter-spacing (it breaks the shirorekha line).
5. **Owned or licensed content only.** No scraping. Every story carries `source` and `licence` fields (own reporter, own website, licensed feed, government release with terms, opt-in syndication). (Janshakti already dropped GNews and Patrika RSS for ToS reasons.) Whether and how to supply ready content, as XLR8 Print claims to with "400+ sources", is an open plan question (see `docs/PLAN_ENHANCEMENT_PROMPT.md` idea 14). Stock assets must be CC0, own-made, or licensed in writing; record the licence per asset.
6. **No silent AI.** Anything automatic is shown as a list of changes the user accepts or undoes. Auto-page v1 uses no LLM at all.
7. **Fonts are bundled files, never system fonts.** Open licences only (Noto Sans/Serif Devanagari, Mukta and similar). The font used to measure is the font used to display and export.
8. **Geometry in millimetres**, origin at the top-left of the trim box. Convert to px only at render time.
9. **Multi-tenant from day one.** Every row has `org_id`; Supabase RLS enforces it. Roles: owner, editor, reporter, designer, viewer.
10. **Friendly by construction.** `docs/UX_SPEC.md` is binding: one primary action per screen, plain Hindi, filled sample before blank page, nothing silent, nothing lost (undo everywhere), gradual disclosure (आसान → और विकल्प → प्रो), keyboard and touch equals, a WhatsApp help button on every screen. `npm run ux` enforces the checkable rules.
11. **The designs are the spec.** `docs/design/*.dc.html` are the approved mockups. Do not redesign. If something is missing, add it to `docs/DESIGN_GAPS.md` and ask.

---

## 3. Architecture

```
studio/
  packages/engine/     pure JS/TS: document model, ops, flow(), fit(), autopage(), dedupe(), preflight rules
  packages/render/     document -> DOM/SVG (preview), document -> HTML for export
  apps/web/            Next.js 14 App Router + Tailwind + Supabase client (editor, desk, dashboards)
  services/export/     container: headless Chromium + Ghostscript (PDF, CMYK, PDF/X, page images)
  harness/             gates, golden tests, benchmarks
  spike/               Phase 0 Pretext parity spike (kept for regression)
  docs/                prompts, design, decisions
```

Stack: TypeScript for `engine`, `render`, `web`. Next.js 14, Tailwind, Supabase (Postgres + Auth + Storage + RLS), Razorpay UPI for billing (Phase 2). npm workspaces. Vitest for unit tests, Playwright for browser tests and visual goldens.

### Layout engine (Phase 0 decides the line-breaker)

- Candidate: `@chenglou/pretext` (`prepareWithSegments`, `layoutNextLine` with a width per line). Gate decides whether it is the live engine, preview-only, or rejected (see Phase 0).
- Wrapper API is ours and stable: `flow({ story, frames, obstacles, styles }) -> { placed: Line[], overflow: Cursor|null }`. If the line-breaker changes, only the adapter changes.
- Obstacles: `{ shape: 'box'|'contour', rect|polygon, offset:{t,r,b,l}, mode:'around'|'jump'|'none' }`. For each text line (y band), compute free intervals in the column; take the widest, or split the line where both sides are usable (document the rule in a decision).
- Justification: engine returns per-line `extraWordSpace`; last line left-aligned.
- No hyphenation for Hindi. Widow/orphan control and keep-with-next for headline+deck are engine options.

### Export pipeline (Phase 2)

Render each page as absolutely positioned lines from the engine (`white-space: pre`, per-line `word-spacing`), so Chromium only shapes inside a line and cannot re-break. Chromium prints PDF (fonts embedded). Ghostscript converts to CMYK with a named ICC profile and checks ink limit; PDF/X output with bleed and crop marks. Run in a container (Cloud Run/Fly/Browserless), not in a serverless function.

### E-paper publish (Phase 2)

From the same layout: page images (WebP, 2 sizes), an **article map** (`story_id -> polygon/rects per page`), per-article share cards for WhatsApp (image + text + link), and a hosted reader page. Reuse the existing `janshakti-epaper` reader where possible; import its article map shape, do not break it.

---

## 4. Data model (v1 sketch — refine in Phase 1 and record in `docs/DATA_MODEL.md`)

```ts
type Mm = number

interface Paper    { id; orgId; name; masthead: MastheadSpec; brand: { colors: string[]; fonts: Record<'kicker'|'headline'|'deck'|'body'|'caption', FontRef> };
                     page: { w: Mm; h: Mm; bleed: Mm; margins: Box }; grid: { cols: number; gutter: Mm; baseline: Mm }; rni?: string; editions: string[] }
interface Issue    { id; paperId; edition: string; number: number; date: string; status: 'draft'|'review'|'approved'|'published'; pages: Page[]; version: number }
interface Page     { id; no: number; templateId?: string; background?: BgSpec; frames: Frame[]; objects: PageObject[]; locked?: boolean }
interface Frame    { id; x; y; w; h; cols: number; gutter: Mm; storyId?: string; nextFrameId?: string }          // threaded text frames
interface Story    { id; orgId; kicker?; headline; deck?; byline?; body: Para[]; assetIds: string[]; source: 'typed'|'paste'|'whatsapp'|'form'|'own-site'|'lead'|'pool'|'agency'; licence: 'own'|'own-site'|'gov-terms'|'pool-licence'|'agency-licence'|'none'; sourceUrl?: string; dedupeKey?: string; status: 'draft'|'approved'; lang: 'hi'|'en'; priority: 1|2|3 }   // status 'approved' requires licence !== 'none'
interface PageObject { id; kind: 'photo'|'box'|'quote'|'shape'|'line'|'ad'|'sticker'|'tag'|'inset'|'label'|'dropcap'|'jump'|'refer';
                     x; y; w; h; rot?: number; z: number; parentId?: string;                                      // parentId = asset on asset
                     wrap: { mode: 'none'|'box'|'contour'|'jump'; offset: Box }; style: Record<string, unknown>; assetId?: string }
```

Rules: ids are stable ULIDs. A story belongs to at most one chain of frames per issue. `parentId` objects move and scale with the parent. The document has a `schemaVersion`; migrations are pure functions with tests.

### Operations (command pattern; undo/redo and autosave come free)

Every change is `{ type, args }` applied by a pure `apply(doc, op) -> doc'` with an inverse. Names come straight from the Guided/Studio designs:

`setColumns`, `moveBlockToColumn`, `moveBlockInColumn`, `moveBlockToStory`, `resizeBlock`, `toggleWrapSide`, `setBlockColor`, `addBox`, `addQuote`, `addSubhead`, `addPhoto`, `addOverlay` (sticker/tag/video/inset/label), `clearOverlays`, `removeBlock`, `setBackground`, `setFont`, `setStyleRole`, `placeStory`, `lockPlacement`, `sendOverflowToPage`, `applyTemplate`, `setObjectGeometry`, `reorderLayer`, `groupIntoParent`, `importStory`, `markDuplicate`, `setStoryLicence`.

Autosave = append ops to an op log (debounced); snapshots every N ops. Concurrent editing is out of scope until after Phase 4; design the op log so it can be added (ops carry `baseVersion`).

---

## 5. What is already designed (map of the mockups)

The 10 boards live in `docs/design/` (published copy: https://claude.ai/artifact/T4G2YCeHkePv24C7wXUEQd).

| Board | What it specifies | Phase |
|---|---|---|
| Main | Desktop editor: layers (पंक्तियाँ), wrap panel, preflight chip, story list with fit % and overflow send, 5 col / 4 mm gutter / 4.2 mm baseline, masthead with ears, page strip | 1 (shell), 4 (full) |
| Guided | **Easy mode**: 7 steps (format, background, upload, stories, WhatsApp, paste, decorate); per-block toolbar (column left/right, up/down, resize, side, colour, move to other story); overlays on photos | 1 |
| AutoPage | Inbox of own stories, lock-in-place, 3 layout options per page, change list with accept/undo, status strip | 1 |
| Phone / MobilePlans | Slot-filling on phone, fit warnings, image dpi warning, plans | 2 |
| Typography | Columns per article, gutter, column rule, headline across, intro paragraph, text-style roles, font pickers, own font upload, Kruti Dev note | 1 (roles, columns), 4 (upload) |
| Backgrounds | Stock/upload backgrounds, placement, fit, opacity, white layer behind text, print warning | 1 (stock), 4 (upload) |
| Assets | 46 assets, tagged V1 / Later / Revenue | 1 (V1 tags), later per tag |
| Studio | Pro mode: rulers, snap, assets on assets, layer tree, a11y chips, keyboard shortcuts | 4 |
| Home / HomePhone | Issue list, 4-step checklist (खबरें → पन्ने → जाँच → प्रकाशित), today's tips, past issues, bottom bar on phone, WhatsApp help pill | 1 |
| Onboarding | 5 phone screens: number, OTP, paper, masthead, filled sample page with coach card (UX_SPEC F1) | 1 |
| Help / HelpSheet | Help hub (WhatsApp, 1-minute videos, plain words, FAQ, report a problem) and the in-context help sheet | 1 |
| Compare | Positioning vs ePaper Designer, XLR8 Print, Canva/Affinity | reference only |

### 5.1 Gaps: not designed yet (log each in `docs/DESIGN_GAPS.md` before building)

Must exist for the first paying weekly (Phase 1–2) (item 10 below is a competitor gap, XLR8 Print's "400+ sources"):
1. **Issue dashboard**: list of issues, status, deadline, edition, "start next issue from last" (copy structure).
2. **Brand setup / onboarding**: masthead upload and ears, colours, fonts, RNI imprint, page size and grid, edition names.
3. **Story desk**: inbox, statuses, reporter roles, approve, edit headline/deck/byline, photo attach, Kruti Dev paste cleaning, word and line counts, "trim to fit" suggestion.
4. **Page navigator**: page thumbnails strip, reorder pages, copy template to page, lock page.
5. **Preflight panel and export flow**: checklist (image dpi, missing fonts, overflow, empty frames, ink limit, bleed, text on dark background), fix-links, export choices (e-paper, press PDF, mobile PDF).
6. **Publish and reader flow**: e-paper link, article map preview, share cards, archive, per-article link.
7. **Billing and plan limits**: UPI checkout, free-4-editions counter, watermark rules.
8. **Ad manager**: booked ads, size slots, WhatsApp booking link, proof to advertiser, revenue report (the "Revenue" tagged assets).
9. **Approval and comments**: proof link, comment on a block, approve page, who changed what.
10. **Content desk**: own-site import, lead radar (headlines + links as tips), duplicate flags with merge/keep, source and licence badge on every story, priority sorting. (Agency feed and sharing pool UI are later.)
11. **Empty, error and offline states** for every screen; undo/redo feedback; autosave indicator.

Add after launch: tithi/panchang strip and Vikram Samvat date; rashifal and mandi-rate blocks fed by an API; reader analytics per article; audio read-aloud; push notifications; template marketplace; school magazine kit (contents page, student bylines, awards); OCR import of old issues; collaboration cursors.

### 5.2 Hindi-specific correctness checklist (engine and render)

- Justified text: stretch word spaces only; keep shirorekha continuous.
- Conjunct and matra clipping at tight leading: verify descender/ascender boxes for Noto and Mukta at 9–14 px.
- Numerals: option for Devanagari digits; consistent in folio, index, jump lines.
- Quotes, danda (।), double danda, ellipsis, mixed English words, URLs as unbreakable tokens.
- Drop cap with conjunct as first grapheme (use `Intl.Segmenter`, never `[0]`).
- Kruti Dev / Chanakya → Unicode on paste with a preview and an undo.

---

### 5.3 UX in one paragraph

The user is a Hindi-first owner who fears breaking things. So: start from a filled sample page (target: first page in 5 minutes), show a 4-step issue checklist (खबरें → पन्ने → जाँच → प्रकाशित), let auto-page propose and the person approve, use a small contextual toolbar (max 5 buttons) instead of panels, describe problems in sentences with fix buttons, autosave and undo everywhere, and keep Pro tools behind an explicit switch. Build `packages/ui` (tokens + 12 components) before any screen. Test with 5 real users at the end of Phase 1 (`docs/USABILITY_TEST.md`).

## 6. Phases and gates

| Phase | Goal | Gate (must pass to leave) | Rough time |
|---|---|---|---|
| 0 | Engine spike and decision | Line-break parity vs real DOM on real Janshakti copy: >= 99.5% GO, 95–99.5% preview-only + server layout, < 95% NO-GO. `flow()` tests pass. | 1–2 wks |
| 1 | Auto-page v1 + Guided editing + content desk v1 + UI system | One real Janshakti weekly built end to end; usability test: 4 of 5 unaided, SUS >= 75, first page in 5 min, 0 serious axe violations and 0 UX-rule violations on Easy-mode routes; every approved story has source + licence; duplicate detection meets the target on the seeded set; >= 70% of stories placed without manual fix on a 20-issue replay corpus; time-to-issue <= 60 min (measured); fit meters match the render; goldens green; 3 design partners using it | 6–8 wks |
| 2 | Press quality + publish + money | **Start only after 3 weeklies have agreed to pay.** CMYK PDF/X from the same layout; printer accepts a real proof; preflight catches seeded faults; e-paper + article map + share cards live; UPI billing live; phone slot mode | 4–6 wks |
| 3 | Assist (AI, approval-based) | Suggestions (trim to fit, headline options, cutlines, photo crop) accepted >= 50% in beta; zero silent changes | 3 wks |
| 4 | Studio (Pro) | Rulers, snapping, assets on assets, contour wrap, own fonts, background upload, keyboard-only and screen-reader pass | 6 wks |

Every phase: update `CLAUDE.md` decision log, `docs/DATA_MODEL.md`, and `harness/gates.json` (flip gates from `pending` to `active`).

---

## 7. Working agreements

- Read `CLAUDE.md` first every session; it is the project memory. Append decisions, do not rewrite history.
- Write the failing test or harness check first for engine work. UI work needs a Playwright check for the happy path and one failure path.
- Small commits, one concern each. Commit messages say why.
- No new dependency without a line in the decision log (name, why, size, licence).
- Keep functions pure where possible; side effects live in `apps/web` and `services/export`.
- Never claim a metric you did not run. Numbers come from `harness/results/*.json`.
- When blocked by a missing design or an ambiguous requirement, stop, write the question in `docs/DESIGN_GAPS.md`, and continue with another task.
- Performance budgets (targets, verify and revise): re-layout of a 3-column story around a dragged photo under 8 ms per frame in the editor; auto-page of an 8-page issue under 5 s; editor first load under 3 s on a mid-range Android phone over 4G.
- Accessibility: keyboard reachable toolbar, visible focus, 4.5:1 contrast, Hindi UI strings first with EN toggle, touch targets >= 44 px.

## 8. First action

Open `docs/phases/phase0-engine.md` and begin. Do not create the Next.js app yet.
