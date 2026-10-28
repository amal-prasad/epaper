# Experiments: first 14 days

Source: `docs/PLAN_REVIEW.md` §5. Fill the results column as each runs. Hand-measured numbers are recorded only by Amal: `npm run record -- <gate> <key>=<n> --by Amal`. Verbatim buyer answers go in `docs/PARTNERS.md`.

| ID | Day | Experiment | Pass | Fail | Result |
|---|---|---|---|---|---|
| E1 | 1 | Printer meeting. Ask in order: (1) do you do composing/layout for clients, at what rate per page; (2) spec sheet (trim, bleed, ink limit, ICC, PDF version, colour pages per edition); (3) file types accepted, black text handling; (4) how many periodicals you print; (5) if no layout service, ask for 5 introductions (H-W); if yes, would his operator use a tool that cuts page time, and what is that worth (H-P) | Spec sheet in hand and ≥ 3 introductions (H-W) or a trial with his operator (H-P) | Neither; ask a second press by day 5 | |
| E3a | 1–2 | `flow.js` to the contract (Phase 0 task 5) | G0.flow ≥ 17 passing, 0 skipped | — | |
| E0 | 2 | Buyer script (below) and free-first-issue offer reviewed by one Hindi speaker | Reviewed | — | |
| E2 | 3–4 | CMYK black-text spike. Inspect how Chromium writes black (`0 0 0 rg` or `/CS0 cs`). Routes: (a) Ghostscript Gray conversion, mono page; (b) `-dBlackText -dBlackVector`, mono page; (c) colour page: rewrite pure black to DeviceCMYK `0 0 0 1` (both forms) then convert; (d) CMYK as is (control). Check with `tiffsep` and `inkcov` | A mono route and a colour route each put text and rules on the K plate only, fonts embedded | No colour route works: v1 ships mono pages; ask the printer about RIP conversion for colour | |
| E3b | 3–5 | Headline parity (weight 700, 18–36 px, Khand, Eczar, Noto) in `spike/run.mjs` (judge change, Amal approves); `flow.png`; `PHASE0_DECISION.md` | `npm run harness -- --phase 0 --done` green; headline fonts ≥ 99.5% and 0 overflows, or failing fonts named and dropped | — | |
| E4 | 4–10 | Five buyer conversations. Qualify first (print run, readers, revenue sources), then layout rate per page and who does it, time per issue, e-paper today, the content question, verbal price reaction. No money asked | ≥ 5 held; ≥ 2 qualified owners name a per-page rate | < 5 held by day 21: pause build after Phase 0 | |
| E5 | 5–6 | Concierge issue: one full Janshakti issue the current way, stopwatch each step | Baseline recorded; three slowest steps named | — | |
| E9 | 7 | Desk check of XLR8 Print and ePaper Designer price pages (1 h) | Compare-board numbers sourced or deleted | — | |
| E6 | 8–12 | Free first issue offer to 2 qualified weeklies (H-W) or a trial week with the printer's operator (H-P) | 1 accepts with a date | 0 of ≥ 4: revisit model, try H-P | |
| E8 | 13 | Free first issue produced and printed | Printed without reprint; owner approves via proof link or WhatsApp. Only then ask for a paid pilot at the per-page rate | — | |
| E10 | 14 | Review: update assumption register, choose H-W or H-P, write decision-log row | Row written | — | |

Not run: fake-door pricing and any UPI pre-booking broadcast (contaminates E6, reads as a scam from a stranger).

## Buyer script (Hindi, for E4)

Qualify:
1. आपका अख़बार कितनी प्रतियाँ छपता है और कौन पढ़ता है?
2. अख़बार की कमाई कहाँ से आती है: विज्ञापन, सरकारी विज्ञापन, सदस्यता?

Layout today:
3. लेआउट अभी कौन बनाता है, और प्रति पन्ना कितना लगता है? (प्रेस वाला या बाहर का ऑपरेटर?)
4. एक अंक बनाने में कितना समय लगता है?
5. प्रेस से कभी फ़ाइल को लेकर दिक़्क़त हुई? क्या दोबारा छापना पड़ा?
6. पुरानी फ़ॉन्ट (कृतिदेव/चाणक्य) की खबरें कैसे संभालते हैं?
7. ई-पेपर अभी बनाते हैं? कैसे?

Content and price:
8. क्या आप तैयार हिंदी खबरें, जिन्हें छापने की अनुमति हो, ₹X प्रति माह में लेंगे? (X: जो बोलें, वही लिखें)
9. अगर अगला अंक हम मुफ़्त बनाकर दें, तो क्या आप प्रेस भेजेंगे? प्रति पन्ना कितना ठीक लगेगा?

Close: एक और अख़बार वाले का नाम बता सकते हैं जिन्हें यह काम का लगे?

## Pilot agreement outline (WhatsApp message, saved in `docs/PARTNERS.md`)

First issue free. Then 4 issues at ₹R per page, paid by UPI within 7 days of print. Customer sends copy and photos by a fixed day and time and owns all content and licences. We deliver press PDF and e-paper by an agreed time. Up to 2 correction rounds. Either side may stop anytime. Samples shown only with permission.
