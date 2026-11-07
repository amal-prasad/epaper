# Design gaps and open questions

Add an entry before building anything the mockups do not cover. Format: `- [ ] G<n> <screen or behaviour> — why it is needed — who decides`.

Order set by the plan review (`docs/PLAN_REVIEW.md` §8). Design before Phase 1 ends:

- [ ] P1-T Templates follow Janshakti's printed pages (6 columns, kicker, byline, inset photos, folio, print line on the last page), where the Main board drew 5 columns (D-058) — the printed pages are what the customer knows; the mockup should be brought into line — Amal
- [ ] P1-C Background removal for cut-outs — Amal may add it, so a photo can become a free-form image, for example beside the masthead. Per D-035 it runs at upload, outside the engine, and stores a transparent image plus an outline polygon. Not designed: the tool or library, its licence and cost, the operator's edge check before accepting, and print quality at the edges — Amal
- [ ] P1-1 Proof link page (G9 reduced): read-only page images, tap to comment, approve, no account — can an owner approve an issue on a phone? — Amal
- [ ] P1-2 Export and preflight checklist (G5 reduced): for the operator first, then the printer sheet — does the printer accept the first file without a call? — Amal
- [ ] P1-3 Paste-and-clean story intake (G3 reduced): Kruti Dev preview, source and licence pick — can a week's copy be cleaned in under 15 minutes? — Amal
- [ ] G10 Empty / error / offline states, autosave indicator, undo feedback — only for the operator tool and proof page in Phase 1

UI v2 (`docs/design/ui-v2.md` §6, D-079). These boards break UX_SPEC in the places below. Amal ruled on 2026-11-07 (D-080, `ui-v2.md` §0): G17 is gated by the check; the boards win on look and wording (G21 themes and glass, the G20 wording, the G22 inspector); UX_SPEC wins on accessibility (G19, and G20's status, help and toast). Each row stays open until its design is drawn:

- [ ] G17 Send to press (v5): the button fires while 5 problems are open and skips जाँच (F5). It claims "छप गया / प्रेस तक पहुँच गई", but the app only makes a PDF. It shows confetti and a printing animation (§11), and auto-publishes the e-paper at 6 am with no confirm (§7). Proposal: the primary button reads "जाँच (N)" and walks the problems, becomes "प्रेस PDF बनाएँ" at 0, and ends on a calm screen with the real file and a proof-link share — Amal
- [ ] G18 Trim (v5 fit fixer): "पाठ छोटा करें" applies the cut in one click (rule 5). The per-cut review is not designed, and the engine has no story-text op with an inverse yet — Amal
- [ ] G19 Editor controls (v5): the bottom toolbar holds 7 buttons and the rail holds 6 (§3: at most 5). Toolbar, undo/redo and swatches are icon only (§8). Page-strip status is shown by colour alone (§2.9). The unplaced story is drag-only and resize is handles only (WCAG 2.5.7). `npm run ux` will fail as drawn — Amal
- [ ] G20 Status, help, wording (v5, v6): no saved/offline status; no help button in the editor (§2.10); the undo toast lasts 5 s, not 8 s (F6); the boards say स्लॉट / पृष्ठ / टेम्पलेट where the glossary says जगह / पन्ना / ढाँचा — Amal
- [ ] G21 Themes and motion (v5, v6): धुंध and रात instead of Light + बड़े अक्षर + हाई कॉन्ट्रास्ट (§8). Glass blur, tilt, parallax and grain, with springs of 450–800 ms, against calm, paper-like design, 150–200 ms motion and low-end Android (§8, §12). The `--font-ui` token names Anek Devanagari, which is not approved — Amal
- [ ] G22 Structure (v5, v6): a permanent right inspector instead of F3's contextual toolbar; Home nav has 5 items plus bell and account, against at most 4 and the issue checklist (§4) — Amal

Design only on a "go" at week 12 (Phase 3, self-serve):

- [ ] G2 Brand setup / onboarding (masthead, ears, colours, fonts, PRGI imprint, page size, grid, editions)
- [ ] G3 Story desk (inbox, statuses, roles, approve, trim-to-fit, Kruti Dev preview)
- [ ] G4 Page navigator (thumbnails, reorder, copy template, lock)
- [ ] G1 Issue dashboard (list, status, deadline, copy-from-last)
- [ ] G7 Billing and plan limits (UPI, free counter, watermark)
- [ ] G6 Publish and reader flow (e-paper link, article map preview, share cards, archive)

Deferred (no customer has asked):

- [ ] G8 Ad manager (slots, booking link, proof, revenue)
- [ ] G9 Approval and comments beyond the proof link
- [ ] G11 Content supply and de-duplication (licensed feeds, syndication pool, own-site import, source + licence badge)

Designed already:

- [x] G12 (docs/design/Onboarding.dc.html) First-run onboarding
- [x] G13 (Help.dc.html, HelpSheet.dc.html) Help hub
- [x] G14 (Home.dc.html, HomePhone.dc.html) Home with issue list and checklist

Questions for Janshakti's printer (experiment E1): do you do composing/layout for clients and at what rate per page; trim size, bleed, ink limit, ICC profile, PDF version, plate-ready or page PDF, colour pages per edition, how black text is handled, how many periodicals you print.
