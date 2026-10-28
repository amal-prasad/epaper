# UX spec — friendly, calm, accessible

Read with `docs/PRODUCT_PROMPT.md`. This is binding for every screen. The mockups in `docs/design/` already follow it in spirit (Guided mode is the model); where a mockup breaks a rule here, the rule wins and the gap goes to `docs/DESIGN_GAPS.md`.

## 1. Who we design for (and what scares them)

| Person | Reality | Fear | Design answer |
|---|---|---|---|
| Weekly owner/editor, 35–60, Hindi-first | Lives in WhatsApp; used to an operator doing the layout; shared office PC or one phone | "I will break it", "English software", "I will look foolish" | One next step per screen, Hindi words, undo everywhere, nothing silent |
| DTP operator | Fast in CorelDRAW/InPage; keyboard-driven | "This is slower than my tool" | Pro mode with shortcuts, rulers, snapping; same file as Easy mode |
| Reporter | Sends text and photos from a phone | Losing work on bad network | Offline drafts, photo compression, WhatsApp intake |
| School teacher / principal | Not a designer; one issue a year | Blank page paralysis | Template-first, fill-in-the-blank pages |
| Printer / press staff | Wants a clean file | Reprints | Plain "ready for press" check |

Assume: low-end Android, 4G that drops, a 14-inch laptop with a mouse, someone older than 50 reading in bright light. If it works there, it works everywhere.

## 2. Ten principles (each is testable)

1. **One next step.** Every screen has exactly one primary button, labelled with a verb ("पन्ने बनाएँ"). Everything else is secondary or hidden.
2. **Show the finished thing first.** Start from a filled sample or a template, never from a blank page. Edit by changing, not by constructing.
3. **Plain Hindi, not software words.** Use the glossary in §6. Labels are at most 3 words. No unexplained English. EN toggle available everywhere.
4. **The machine proposes, the person decides.** Auto-page shows what it changed; accept or undo. No silent changes, ever.
5. **Nothing is ever lost.** Autosave, universal undo, "yesterday's copy". Prefer an Undo toast over a "Are you sure?" dialog. Confirm only for things that cannot be undone (delete issue, publish).
6. **Reveal gradually.** Three levels: **आसान** (default) → **और विकल्प** (drawer on the selected item) → **प्रो** (explicit switch). Advanced settings never appear in Easy mode unprompted.
7. **Say what is wrong in words, and offer the fix.** Warnings are sentences with 1–3 buttons that fix them. Never a code, never blame.
8. **Touch and keyboard are equals.** Everything draggable also has buttons or arrow keys. Everything has a visible focus. Works one-handed on a phone.
9. **Honest, calm status.** Saving, offline, fit, price: always visible, never alarming. Colour never carries meaning alone (icon + word).
10. **A human is one tap away.** Every screen has the same "मदद चाहिए? WhatsApp पर पूछें" button in the same place, plus a 60-second Hindi video for the current step.

## 3. Cognitive-load rules (enforced by `harness/ux/ux-lint.mjs`)

- Exactly one visible `[data-ux="primary"]` per screen.
- Toolbars (`[data-ux="toolbar"]`) hold at most 5 buttons; more go under "और".
- At most one side panel open; at most one modal; no modal on top of a modal.
- Maximum nesting: 3 levels (Home → Issue → Page). No deep menus.
- Per selected object, at most 6 visible settings; the rest under "और विकल्प".
- Body text at least 16 px on desktop and 18 px on phones; no text under 14 px anywhere (captions only).
- Touch targets at least 44×44 px on phones (WCAG 2.2 minimum is 24 px; we aim higher); at least 32 px on desktop.
- Every page has `lang`, a consistent help link, a visible focus style, and an accessible name on every control and image.

## 4. Information architecture

```
Home (अंक)                         ← list of issues, big "नया अंक बनाएँ", "पिछले अंक जैसा बनाएँ"
 └─ Issue workspace                ← a 4-step checklist, always visible
     1 खबरें     (story desk: type, paste, WhatsApp, own-site import, lead radar)
     2 पन्ने     (auto-page options → page editor: आसान | प्रो)
     3 जाँच      ("छपाई से पहले जाँच": plain-language checklist with fix buttons)
     4 प्रकाशित  (press PDF · e-paper · WhatsApp cards)
Settings (अख़बार की जानकारी)       ← masthead, colours, fonts, page size, RNI, editions
Help (मदद)                          ← videos, WhatsApp, glossary
```

Top-level navigation has at most 4 items (Home, Settings, Help, account). On phones: a bottom bar with 3 items (अंक, खबरें, मदद). The issue checklist replaces menus: it shows where you are and what is left ("4 में से 2 काम पूरे").

## 5. Key flows (target steps and times)

**F1 First run (target: first page in 5 minutes).** Phone number + OTP (no password) → paper name and type (साप्ताहिक / दैनिक / विद्यालय) → masthead: upload or pick a sample → **"देखिए आपका पहला पन्ना"**: a filled sample front page appears. Coach marks (5, skippable) point at: story, photo, "पन्ने बनाएँ", "जाँच". Sample content is labelled "नमूना" and removable in one tap.

**F2 Build an issue (target: 60 minutes, all pages).** नया अंक → choose format → add stories (paste is the primary path; Kruti Dev is fixed on paste with a preview) → **पन्ने बनाएँ** → for each page choose one of 3 options → fix with the toolbar → जाँच → प्रकाशित.

**F3 Fix a block.** Tap a block → a small contextual toolbar appears next to it with at most 5 buttons (e.g., ← कॉलम, कॉलम →, ↑ ↓, आकार, और). No panels open by themselves. Drag also works; arrow keys nudge.

**F4 Add a photo.** "+ फोटो" → pick from gallery/camera → auto-crop to the slot → four picture-based wrap choices (चारों ओर, ऊपर-नीचे, सिर्फ़ ऊपर, पीछे) instead of "wrap mode". Low resolution gets a plain warning and a fix.

**F5 Check and publish.** "जाँच" lists problems as sentences with fix buttons; zero problems shows "सब ठीक है — छपाई के लिए तैयार". Publishing shows what will happen and what it costs before any payment.

**F6 Recover.** Undo (Ctrl/⌘ Z and a visible button), "पिछला वापस लाएँ" toast for 8 seconds after any removal, "कल की कॉपी" in the page menu.

**F7 Phone slot-filling.** One slot per screen: "स्लॉट 2: फोटो" → camera/gallery → "फिट" check → next. Works offline; syncs on reconnect.

## 6. Plain-language glossary (validate wording with 5 real users before shipping)

| Software word | Say in Hindi UI | Note |
|---|---|---|
| Preflight | छपाई से पहले जाँच | |
| Overflow | खबर बड़ी पड़ गई / जगह कम पड़ी | show line count |
| Underfill | जगह खाली बची है | |
| Gutter | कॉलम के बीच की जगह | hidden in Easy mode |
| Bleed | कटाई का किनारा | only in export/Pro |
| Layer | ऊपर-नीचे की परत | Pro only |
| Wrap | टेक्स्ट कैसे चले | with picture choices |
| Template | ढाँचा | |
| Masthead | शीर्षक पट्टी (नाम) | use the paper's own word if different |
| Slot | जगह | |
| Publish | प्रकाशित करें | |
| Draft | मसौदा | |
| Duplicate | मिलती-जुलती खबर | |
| Licence/source | स्रोत और अनुमति | |

## 7. Microcopy (voice: respectful "आप", short, no blame)

| Situation | Hindi | Buttons |
|---|---|---|
| Saving | सहेज रहे हैं… / सहेजा गया ✓ | |
| Offline | इंटरनेट नहीं है। आपका काम इस फ़ोन में सुरक्षित है; जुड़ते ही सहेज लेंगे। | |
| Removed | खबर हटाई गई। | वापस लाएँ |
| Story too long | खबर थोड़ी बड़ी पड़ गई (6 पंक्तियाँ ज़्यादा)। | छोटा करें · अगले पन्ने पर भेजें · ऐसे ही रखें |
| Space left | जगह खाली बची है (4 पंक्तियाँ)। | फोटो बड़ी करें · खबर बढ़ाएँ |
| Low-res photo | यह फोटो छपाई में थोड़ी धुंधली दिख सकती है। | दूसरी फोटो चुनें · फिर भी रखें |
| Old-font text | यह पुराने फ़ॉन्ट का टेक्स्ट लगता है। सही हिंदी में बदलें? | बदलें · जैसा है वैसा रखें |
| Duplicate | यह खबर "…" जैसी ही लग रही है। | एक रखें · दोनों रखें |
| No source | यह खबर कहाँ से आई? स्रोत चुनें, फिर पन्ने पर लगाएँ। | स्रोत चुनें |
| Empty issue | अभी कोई खबर नहीं है। पहली खबर चिपकाएँ या WhatsApp से मँगाएँ। | खबर चिपकाएँ · WhatsApp से लें |
| All clear | सब ठीक है — छपाई के लिए तैयार। | प्रेस PDF बनाएँ |
| Publish | ई-पेपर प्रकाशित करें? पाठक इसे तुरंत देख सकेंगे। बाद में रोक भी सकते हैं। | प्रकाशित करें · अभी नहीं |
| Help | मदद चाहिए? WhatsApp पर पूछें | |
| Payment | इस अंक का ₹15 लगेगा। पहले 4 अंक मुफ़्त हैं। | UPI से भरें |

Error pattern: what happened → why it is okay or what to do → one-tap fix. Never show stack traces, status codes or English-only errors to users; log them.

## 8. Visual design

- **Mood:** calm, warm, paper-like. A light warm-white background, dark ink text, one primary colour for the single main action, a quiet neutral for everything else. No dense dark toolbars in Easy mode.
- **Type:** UI in Noto Sans Devanagari or Mukta (whichever passes the Phase 0 gate), line-height at least 1.6 for Devanagari, base 16 px (18 px phone). Headings are bold, not tiny caps. Latin text uses the same family so mixed lines look even.
- **Space:** 8-pt scale (4, 8, 16, 24, 32). Generous padding; the page canvas is the hero, chrome stays small.
- **Colour tokens (names fixed, values tuned in design):** `--ink`, `--paper`, `--primary`, `--primary-ink`, `--ok`, `--warn`, `--danger`, `--muted`, `--focus`. Contrast 4.5:1 minimum for text; 3:1 for UI edges; `--focus` ring at least 3 px and visible on every background.
- **Icons:** always with a word in Easy mode. Icon-only buttons appear only in Pro, with tooltips and shortcuts.
- **Motion:** short (150–200 ms), purposeful (show where a block went), off with `prefers-reduced-motion`.
- **Modes:** Light (default), **बड़े अक्षर** (A+ scales UI 125%), **हाई कॉन्ट्रास्ट**. Dark mode is optional later.
- **Density:** Easy mode shows the page large with a single contextual toolbar. Pro mode may be denser but still groups tools and hides rarely used ones.

## 9. Interaction patterns

- **Contextual toolbar** near the selection; never a permanent wall of buttons.
- **Drag with help:** ghost preview, snap highlights, "यहाँ रखें" buttons as the non-drag alternative (WCAG 2.2 Dragging Movements).
- **Resize:** corner handle plus ↔ ↕ buttons plus arrow keys.
- **Page navigator:** thumbnails strip; current page clearly marked; "पन्ना N / M".
- **Fit meter:** a word and a bar ("सही भरा · 98%"), not a bare number.
- **Auto-page change list:** each change is a sentence with accept/undo; "सब मंज़ूर" once reviewed.
- **Zoom:** fit-to-width by default; pinch and buttons; remembers per page.
- **Shortcuts:** shown in tooltips; a "?" opens a one-screen list. Never required.

## 10. Accessibility (target WCAG 2.2 AA)

Keyboard path for every task; visible focus; no keyboard traps; 200% zoom without loss; drag alternatives (2.5.7); minimum target size (2.5.8); consistent help placement (3.2.6); no re-asking known data (3.3.7); OTP login without cognitive puzzles (3.3.8); status changes announced (`aria-live`) in Hindi ("खबर कॉलम 2 में गई"); page content has proper headings and landmarks; images have alt text, decorative images are hidden; reduced motion respected; screen-reader labels in Hindi with `lang="hi"` and English fragments marked `lang="en"`. Test with TalkBack on Android and NVDA on Windows, plus keyboard-only and 200% zoom.

## 11. States every screen must have

Loading (skeleton, not a spinner alone) · Empty (what to do next) · Saving/Saved · Offline · Error with fix · Success (small, calm, not confetti) · Read-only (proof link) · Permission denied (who can change this).

## 12. Performance as UX

First useful screen under 3 s on a mid-range Android over 4G (target). Editor drag stays smooth (re-layout under 8 ms per frame, target). Images compressed in the browser before upload with a progress bar and "रद्द करें". Skeletons, not blank screens. Large operations (auto-page, export) show steps and an honest estimate, and can be left running ("आप दूसरा काम कर सकते हैं").

## 13. Trust and support

- Price before payment; free first 4 editions; no card needed; cancel anytime in two taps.
- Source and licence badge on every story; dedupe warnings explain themselves.
- Every screen: WhatsApp help button (same position), a 60-second Hindi video for the step, "समस्या बताएँ" that attaches the current page state with consent.
- Weekly "आपका अंक" summary on WhatsApp: what is pending, what is ready.

## 14. Measuring it (see `docs/USABILITY_TEST.md`)

| Gate | Target (estimate; revise after the first round and log it) |
|---|---|
| G1.firstpage | New user sees a filled first page within 5 minutes, unaided |
| G1.usability | At least 4 of 5 testers finish "build a page from 3 stories" unaided |
| G1.sus | SUS score at least 75 (68 is average) |
| G1.a11y | 0 serious or critical axe violations on Easy-mode routes |
| G1.ux | 0 violations of the cognitive-load rules in §3 |
| G4.a11y | Pro mode passes keyboard-only and screen-reader runs |

## 15. What to build first (UI system)

Create `packages/ui` before screens: tokens, the 12 components below, each with Hindi labels, states, keyboard behaviour, and a story page. `Button` (primary/secondary/quiet), `Toolbar`, `Toast` (with undo), `Sheet` (bottom sheet and side drawer), `Stepper` (issue checklist), `StatusPill` (saved/offline/fit), `Card` (story, page option), `EmptyState`, `Callout` (warning with fix buttons), `HelpButton`, `Tooltip`, `PageThumb`. Screens are assembled from these only; a new component needs a decision-log line.
