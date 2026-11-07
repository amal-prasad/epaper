# Studio UI v2 — the app's target behaviour

Source: `ui/Studio — UI UX v2.html` (Amal, 2026-11-07, D-079), with stills in `ui/Studio — UI UX v2-png/`. The HTML holds two clickable boards, each 1440 px wide:

- **v6 Home** (होम: एक नज़र में, एक अगला कदम), 1440×1320
- **v5 Editor** (संपादक: ठीक करें, फिर प्रेस को भेजें), 1440×1040

This file writes down what those boards do, so the app can be built to match. Where a board breaks `docs/UX_SPEC.md`, UX_SPEC wins until Amal decides otherwise (UX_SPEC preamble). Each such conflict is listed in §6 and has a row in `docs/DESIGN_GAPS.md` (G17 onwards).

**Numbers.** Every figure below (113%, 97%, 108%, "30 घंटे", "6 पंक्तियाँ") is a mockup value, not a measurement (rule 7). In the app, every fill percentage and line count comes from `fit()` in `packages/engine/src/flow.js`. A predicted fill for a fix option comes from a trial run of the real op on a copy of the document.

D-077's rejected design system (`docs/design/studio-ds/`, `docs/design/studio-system/`) is **not** a source, even though some token names match.

---

## 0. Amal's rulings (D-080, 2026-11-07); these override the sections below

1. **Send to press is gated by the check.** While problems are open, the primary button reads **"जाँच (N)"** and walks through them across pages. At 0 it becomes **"प्रेस PDF बनाएँ"**. It ends on a calm screen with the real file, a download and a proof-link share. There is no confetti, no "छप गया" and no automatic e-paper publishing.
2. **Case by case.** The boards win on **look and wording**: धुंध/रात, glass, the layout including the right inspector, and स्लॉट/पृष्ठ/टेम्पलेट. UX_SPEC wins on **accessibility**: a word next to every icon (or a visible label/tooltip), at most 5 buttons per toolbar, status that is never colour alone, an 8 s undo toast, a save/offline status, a help button on every screen, button alternatives to drag, and reduced motion.
3. **All four §7 proposals are adopted:** preview a fix on hover, trim review in place, a problem queue across pages, and a thumbnail page strip.
4. **No percentages in the operator UI.** In Amal's words: "dont go much by percentage, ultimately they can judge visually, percentages are for us to judge". The operator sees **lines** ("6 पंक्तियाँ ज़्यादा", "4 पंक्तियाँ खाली") and the **visual result** (red overflow mark, blue empty hatch, the ghost preview on hover). Fix options say what happens in words: "फिट हो जाएगी", "2 पंक्तियाँ अभी भी ज़्यादा", "कोई शब्द नहीं बदलेगा". The big "113%" number, the % chips on fix options and "98% भरी" in the story list are replaced by line counts or a ✓. Percentages stay in `fit()`, tests, demos and internal tools, where they let us trim or adjust to fill the page.
5. **The first Home slice is core only:** the hero (status, अगला काम, अंक खोलें), a paste-in story inbox with "पृष्ठ N पर रखें" and undo, and the templates row. Ads, the bell, account, search, the WhatsApp/email inbox and the Word/PDF drop are hidden.

## 1. Look

| Part | v2 value |
|---|---|
| Themes | Two: **धुंध** (default, a blue-grey sky gradient that fades to near-white) and **रात** (dark). They are switched by swatches. |
| Surfaces | `glass` (white at 62%, 24 px backdrop blur, 1 px white edge), `raised` (solid surface, small shadow), `sunk` (inset, 6% ink) |
| Primary | Dark ink pill `#1f3240`, white text, inner highlight and drop shadow |
| Brand mark | A red `#e5483b` rounded square holding "अ", with a white dot |
| Status colours | danger `#d92d20` (over), info `#1c6fd6` (empty), success `#1f8a4c` (fits). Each has a `-soft` background and a `-text` colour. |
| Content pigments | mehendi (stories), neel (photos), gulal (ads), kesar (templates), kattha (issues/pages), mor (fonts), haldi (shapes). Each appears as a 15% tint tile with an icon. In धुंध they are muted. |
| Type | UI: Noto Sans Devanagari, 18/29 base; labels 15–17; the smallest UI text is 14 px. Page preview: Rozha One (masthead), Khand 700 (headlines), Noto Serif Devanagari (body). The `--font-ui` token also names Anek Devanagari, which is not an approved font (D-077, D-078): drop it. |
| Radii | 8 / 13 / 20 / 28 / 32 / pill |
| Motion | Ripple from the point pressed; spring press (scale .95–.97); 3D tilt with glare and parallax on hero and template cards; sliding pill indicators (nav, mode switch, toolbar); a toast rises from the bottom; a story slides out when placed; the fit meter fill animates. Spring durations are 450–800 ms. All motion is off under `prefers-reduced-motion`. |

Token values for both themes are in the `T` object inside each board's script, in the HTML file.

## 2. Home (v6)

**Job:** see where this week's issue stands at a glance, and take the one next step.

Layout: a top bar (brand with paper name, search, a bell with an unread dot, account). A left glass sidebar (nav, theme swatches, help). The main column holds the hero, then two cards side by side, then templates.

| Element | Behaviour |
|---|---|
| Nav | होम, मेरे अंक, खबरें (with a count badge for unplaced stories, which disappears at 0), विज्ञापन, टेम्पलेट. A raised pill slides to the current item. |
| Hero card | Chip "अंक 214 · शुक्रवार, 13 नवंबर". H1 "अंक 214 आधा तैयार है". Line "शुक्रवार सुबह प्रेस में जाएगा। अभी 30 घंटे बाकी हैं।" A strip of 8 small page glyphs, each तैयार (filled), काम (light) or खाली (dashed), with a legend and counts. **Primary: "अंक खोलें →"** opens the editor. Beside it: "अगला काम: पृष्ठ 1 की एक खबर थोड़ी बड़ी है". Decoration: a mini front page. |
| नई आई खबरें | Count badge. Each row shows a thumbnail, headline, a source chip ("WhatsApp · सिटी डेस्क", "ईमेल · संपादकीय डेस्क"), and a green ✓ fit hint ("पृष्ठ 1 की खाली जगह में ठीक बैठेगी", "पृष्ठ 4 पर जगह है"). The button "पृष्ठ N पर रखें →" places the story: the row slides out and a toast says "<headline> पृष्ठ N पर रखी गई" with **वापस लें**, which puts it back. The toast lasts 5 s. When the list is empty: "सब खबरें अपनी जगह लग गईं · नई खबर आते ही यहाँ दिखेगी". |
| कुछ नया बनाएँ | Four tiles: नया अंक (8 पृष्ठ, पिछले अंक जैसा), खबर लिखें (लिखें या चिपकाएँ), फोटो डालें, विज्ञापन जोड़ें. Below them a dashed file drop: "फ़ाइल यहाँ छोड़ें · Word, PDF, फोटो या WhatsApp से". |
| टेम्पलेट से शुरू करें | Four tilt cards with a tag (लोकप्रिय/नया/स्कूल/मौसमी), a mini page, a name and meta: मुखपृष्ठ क्लासिक (5 कॉलम, साप्ताहिक), खेल पृष्ठ, स्कूल पत्रिका (A4), त्योहार विशेषांक. |
| Sidebar foot | रंग-रूप swatches; "मदद चाहिए? हिंदी में पूछें". |
| ≤ 820 px | Search wraps to a full row, nav becomes a horizontal scroller, the sidebar foot and hero art are hidden. |

## 3. Editor (v5)

**Job:** fix what is wrong on the page, then send to press.

Layout: a glass header; under it a 5-column row: tool rail, story list, page canvas, inspector.

### 3.1 Header
- Brand mark links back to Home, with context "अंक 214 / पृष्ठ 1, मुखपृष्ठ".
- Undo (Ctrl Z) and redo (Ctrl Y) buttons, icon only.
- Mode switch: **डिज़ाइन** | **पाठक की तरह देखें**. Reader mode hides selection chrome.
- Theme swatches.
- **Primary: "प्रेस को भेजें" with a count badge** (open problems in the issue: 5 in the mock, 4 after the page-1 fix).

### 3.2 Tool rail (left, 80 px)
खबरें, फोटो, विज्ञापन, टेम्पलेट, आकार, फ़ॉन्ट. Each has an icon tile and a word. A raised pill slides to the active tool. Only खबरें has a panel in the mock.

### 3.3 Story panel
- Search "खबर खोजें".
- **इस पृष्ठ पर (4 खबरें):** a card per story with thumbnail, headline and status chip: "98% भरी" (green) or "6 पंक्तियाँ ज़्यादा" (red). Clicking a card selects its slot.
- **बिना जगह:** a dashed card for an unplaced story: "स्लॉट 5 में खींचें, 99% भरेगी" (drag).

### 3.4 Canvas
- A page strip pill (1–8). The current page is filled dark. A small bar under each number shows status: red = problem, blue = empty, grey = fine. Each button's aria-label holds the word.
- The page is drawn at about 62%: masthead, dateline rule, slots, ad box ("विज्ञापन · [विज्ञापनदाता का नाम] · 5 कॉलम × 9 सेमी, सामग्री आ गई").
- **Overflowing slot:** red ring, a pink fade at the bottom, and a red pill under it: "6 पंक्तियाँ ज़्यादा".
- **Empty space:** a blue dashed, hatched box: "4 पंक्तियाँ खाली · छोटी खबर या कोटेशन रखें".
- **Selection:** a blue box with 4 corner handles and a label "स्लॉट 3, 2 कॉलम". It glides between slots.
- Floating bottom toolbar: चुनें (V), पाठ (T), फोटो (P), बॉक्स (B), कोटेशन (Q), all icon only; then zoom − 62% +.

### 3.5 Inspector (right). Its content depends on the selection.

**A. Overflow selected → "fit fixer"**
- Header: ⚠ "खबर थोड़ी बड़ी है" + headline.
- A large number "113%" + "6 पंक्तियाँ ज़्यादा". A bar with a 100% tick, scaled 0–125%, with the overflow part in red.
- **ठीक करने के तरीके**, ranked, each showing its predicted fill:
  1. **स्लॉट 4 से अदला-बदली**: "सबसे अच्छा: कोई शब्द नहीं बदलेगा", 97%. It is outlined as the recommended option.
  2. **शीर्षक छोटा करें**: "20 से 17 pt, अकेले काफ़ी नहीं", 108%. This is a toggle: pressed, it shrinks the headline and the meter moves to 108% / 4 lines.
  3. **पाठ छोटा करें**: "6 पंक्तियाँ, हर कटौती आप देखकर मानेंगे", 100%.
  4. **स्लॉट बड़ा करें**: disabled, dashed, with a reason: "नीचे विज्ञापन है, यहाँ नहीं हो सकता".
- Applying swap or trim shows a toast with वापस लें and switches the panel to B.

**B. Fixed → success**
- A check pops in with a dot burst. "बढ़िया, फिट हो गई!" and the new fill ("97% भरी").
- A plain account of what changed, e.g. "खेल वाली खबर स्लॉट 4 में गई, मंडी वाली स्लॉट 3 में। किसी खबर का एक भी शब्द नहीं बदला।" or "आपकी मंज़ूरी से 6 पंक्तियाँ कटीं। मूल पाठ सुरक्षित है।"
- A **वापस लें** button.
- An **अगला काम** card: "स्लॉट 5 में 4 पंक्तियाँ खाली →", which selects that slot.

**C. Empty slot → filler**
- "4 पंक्तियाँ खाली हैं · खबरों में शब्द नहीं जोड़े जाते".
- Choices: the unplaced short story (90 शब्द, 99% भरेगी, recommended); a pull quote from another story on the page; the paper's own house ad ("अपने इलाके की खबर भेजें" + WhatsApp number).

**D. A slot that fits → properties**
- "सब ठीक है" + headline, a large fill number, कॉलम with − / + buttons, शब्द count, and a button "फ़ॉन्ट और रैप बदलें".

### 3.6 Send to press (as drawn)
Clicking **प्रेस को भेजें** opens a modal at once. It shows a printing-press animation (roller, sheet feeding, confetti), "अंक 214 छप गया", "प्रेस PDF प्रेस तक पहुँच गई। ई-पेपर शुक्रवार सुबह 6 बजे अपने-आप खुलेगा।", and the buttons "पाठकों को WhatsApp पर भेजें" and "ठीक है". See §6 for why this cannot ship as drawn.

## 4. Data each screen needs

| Screen bit | Needs | Exists today |
|---|---|---|
| Hero status | issue number, date, press deadline, page count, per-page state | Issue JSON has pages. There is no deadline field and no rule for when a page counts as "तैयार". |
| Page state तैयार/काम/खाली | rule: खाली = no story placed; काम = any fit problem; तैयार = all slots between the fill limits | `fit()` gives the fill; the rule is new |
| Fit hint on inbox rows | for each story, the best empty slot and its predicted fill | `autopage()` / `fit()` can compute it; the call is new |
| Problem count on the primary button | problems across the issue (over, under, empty) | new, built from `fit()` |
| Fix options and their % | trial-apply each candidate op on a copy, run `fit()` | swap = two `placeStory` ops (needs a grouped op so one undo covers both). Headline size: **no op yet**. Trim: **no op yet** (needs a story-text op with an inverse, plus a review UI). Grow slot = `setObjectGeometry` + an obstacle check. |
| Disabled reason ("नीचे विज्ञापन है") | collision with the next object below | geometry is available; the reason text is new |
| Story source chip | `story.source` (and licence, rule 4) | source and licence are on stories (D-009) |
| Column − / + | an op to change the column count | `setObjectGeometry` covers width; there is no column-count op |

## 5. Phase 1 scope map (D-076: operator tool, local store, minimal UI)

| v2 element | Phase 1 task it serves | Slice |
|---|---|---|
| Editor canvas, selection, page strip | Minimal Guided toolbar; page navigator | **Build** |
| Fit fixer (swap, headline, grow) | Fit meters; auto-page accept/undo | **Build** |
| Trim with review | Fit meters | **Build after** the trim op and review UI are designed (G18) |
| Filler panel | Auto-page v0 | Build (short story, house ad); the pull quote comes later |
| Toast with undo | ui component "Toast with undo" | **Build** |
| Undo / redo | Document ops + undo | **Build** |
| पाठक की तरह देखें | Page images / e-paper / proof link | **Build** (the same renderer) |
| प्रेस को भेजें | Press PDF export | **Build, gated by जाँच** (G17) |
| Home hero + अगला काम + page strip | Operator overview | **Build** |
| नई आई खबरें (paste and file intake) | Kruti Dev / paste intake | **Build** for paste and .txt only |
| Inbox from WhatsApp / email | WhatsApp Business API is out of scope | Later |
| Word/PDF drop | not planned | Later |
| Templates row | Templates (JSON, no editor) | Build as a picker of existing templates |
| Nav: विज्ञापन, bell, account, search | G8 ad manager deferred; auth out of scope | **Out** (hide) |
| Tool rail: फोटो, विज्ञापन, आकार, फ़ॉन्ट | only photo swap is in Phase 1 | फोटो only; the rest are hidden |
| Theme रात | UX_SPEC §8: dark mode later | Out (see G21) |
| Phone layout | phone mode out of scope | Out |

## 6. Where v2 breaks UX_SPEC (UX_SPEC wins until Amal decides)

| # | v2 does | UX_SPEC says | Gap |
|---|---|---|---|
| 1 | "प्रेस को भेजें" works while 5 problems are open, and skips the check | F5: जाँच lists problems with fixes; "सब ठीक है" comes before the press PDF | G17 |
| 2 | Shows "छप गया / प्रेस तक पहुँच गई", which is false: the app makes a PDF and delivers nothing | §2.9 honest status; rule 7 | G17 |
| 3 | Confetti, a printing animation, a dot burst on fit | §11: success is small and calm, not confetti | G17 |
| 4 | E-paper "अपने-आप खुलेगा" at 6 am, with no confirm | §7: publishing asks for a confirm; scheduling is not in scope | G17 |
| 5 | Trim is applied in one click | Rule 5 / §2.4: no silent change; each cut is reviewed | G18 |
| 6 | The bottom toolbar holds 5 tools + 2 zoom buttons; the rail holds 6 | §3: toolbars hold at most 5 | G19 |
| 7 | Icon-only toolbar, undo/redo and theme swatches | §8: icons always with a word in Easy mode | G19 |
| 8 | The page-strip status is a coloured bar only | §2.9: colour never carries meaning alone | G19 |
| 9 | No saved/offline status anywhere | §2.9, §11 | G20 |
| 10 | No help button in the editor; Home's help is not the WhatsApp one | §2.10: the same help button in the same place on every screen | G20 |
| 11 | The undo toast lasts 5 s | F6: 8 s | G20 |
| 12 | Says स्लॉट, पृष्ठ, टेम्पलेट | §6 glossary: जगह, पन्ना, ढाँचा | G20 |
| 13 | Themes धुंध/रात; no बड़े अक्षर or हाई कॉन्ट्रास्ट | §8: Light, A+ (125%), high contrast; dark later | G21 |
| 14 | Glass blur, tilt, parallax, grain; springs of 450–800 ms | §8: calm and paper-like, motion 150–200 ms; §12: low-end Android | G21 |
| 15 | A permanent right inspector | F3 / §9: a small contextual toolbar next to the block; no panel opens by itself | G22 |
| 16 | Home nav has 5 items plus bell and account | §4: at most 4 top-level items; the issue checklist (खबरें/पन्ने/जाँच/प्रकाशित) replaces menus | G22 |
| 17 | Drag-only for the unplaced story; handles only for resize | §9 / WCAG 2.5.7: a "यहाँ रखें" button and ↔ ↕ buttons too | G19 |

What v2 does better than UX_SPEC, worth keeping as the spec:
- **Ranked fix options, each with its predicted fill and a disabled option that gives its reason.** This goes further than §7's three plain buttons.
- **Fill as a big number + words + a bar with a 100% tick.** This meets §9 "fit meter".
- **An अगला काम chain** after each fix.
- **"स्लॉट 4 से अदला-बदली: कोई शब्द नहीं बदलेगा"**: fixes that keep the words come first.
- **Reader preview mode** in the editor header.

## 7. Suggestions that go beyond v2 (proposals; Amal decides)

1. **The check drives the primary button.** While problems are open, the primary button reads **"जाँच (5)"**. It walks through the problems one by one across pages ("5 में से 1 →", key N), reusing the fixer panel. At 0 it becomes **"प्रेस PDF बनाएँ"**. This gives one primary action, satisfies F5, and replaces the hero's static "अगला काम" with a live queue.
2. **Preview a fix before applying it.** Hovering or focusing a fix option draws that result as a ghost on the page: the new headline size, or the swapped stories. The meter shows its fill. Clicking applies it. This fits "the machine proposes, the person decides", and the engine is fast enough to re-flow on hover (§12 target under 8 ms).
3. **Trim review in place.** "पाठ छोटा करें" strikes through the proposed cuts in the story on the page. Each cut is accepted or kept on its own, and the meter updates live. The original text is stored with the op, so undo restores it exactly.
4. **A calm, honest finish.** Replace the press animation with a small check and real outputs: file name, page count, colour route, preflight result ("सब ठीक है"), **डाउनलोड**, and **प्रूफ़ लिंक भेजें** (WhatsApp share of the proof page, P1-1). E-paper publishing is a separate step with its own confirm.

Smaller ones:
- The page strip becomes thumbnails, with status shown as an icon plus a word (! ज़्यादा, ◌ खाली, ✓).
- The theme swatches become **A+** and **हाई कॉन्ट्रास्ट** toggles; रात comes later.
- Glass surfaces only above 1024 px and when the device is not low-end. Elsewhere surfaces are solid `raised`. Motion is capped at 200 ms.
- A header status pill: "सहेजा गया ✓" / "इंटरनेट नहीं है".
