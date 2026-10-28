# Studio: enhanced plan (plan review, 2026-10-28, revision 2)

Status: approved by Amal on 2026-10-28. Supersedes the timing, order and gates in `docs/PRODUCT_PROMPT.md` §6 and the old phase files where they disagree; the phase files in `docs/phases/` were rewritten to match.

Context: `docs/PLAN_ENHANCEMENT_PROMPT.md` asks for a red-team of the draft kit and a smaller, better-ordered plan. Founder answers (2026-10-28): 35+ h/week for 12 weeks (about 420 hours; hours after week 12 unknown), no revenue deadline, Janshakti is a test bed and will not pay, business shape is services plus software, 0–2 weeklies reachable by name, Janshakti's printer likely willing to introduce customers, budget under ₹5,000/month before revenue.

Revision 2 applies Amal's review: the printer may be a competitor or the buyer; hours re-budgeted; gates count every produced issue; one kill schedule; the real competitor is the local DTP operator; no price broadcast; segment qualification; hosting and backup; Ghostscript test routes; doc model first; an explicit week-12 go decision; 10% close rate.

Evidence used: `harness --list` (G0.parity, G0.guard, G0.flow active; everything else pending); `spike/out/report.md` (99.7% parity, 3547/3556 lines, 127 real paragraphs, 0 overflows, weight 400 only, 12/14 px only); `harness/results/tests.json` (57 pass, 0 fail, 12 flow tests skipped because `flow.js` does not exist). `docs/PHASE0_DECISION.md` does not exist yet.

**The one kill schedule (used everywhere below):** founder minutes per produced 8-page issue (B.minutes), measured as the median of the last 4 produced issues (Janshakti and paid alike): **≤ 150 by end of week 8, ≤ 90 by end of week 12.**

---

## 1. Verdict

1. The engine bet is already won: parity is 99.7% with 0 overflows on 127 real paragraphs. The draft still spends Phase 0 time on a HarfBuzz fallback and font diagnosis that the data says are not needed.
2. The order is wrong for a services-plus-software business. The draft puts the press PDF in Phase 2, behind a Phase 1 that needs a UI system, usability tests with 5 strangers and 3 design partners. You cannot sell a laid-out issue that cannot go to press, and you can name only 0–2 buyers.
3. The binding constraint is sales reach and founder hours. The printer is the only channel in hand, and the printer may already sell layout to the same weeklies; find that out on day 1.
4. Fix: finish Phase 0 in two weeks, then build an operator tool that you use to produce real issues (engine, ops, templates, auto-page v0, press PDF, e-paper). Sell finished issues (or the tool to the printer's operator). Self-serve UI, usability gates, billing, phone mode and WhatsApp API wait for the week-12 go decision.
5. Services alone is a research instrument, not a business (base case about ₹8,600/month contribution). Week 12 decides: go to software, stay services, or stop (§6, Week-12 decision).

## 2. Red-team findings

| # | Where | Problem | Severity | Fix |
|---|---|---|---|---|
| 1 | `docs/phases/phase2-press-publish.md` (whole phase) vs services model | Press PDF, printer proof and CMYK come after Phase 1 and after "3 weeklies agreed to pay". A paid issue needs a press file, so first revenue is blocked by the phase order. | blocker | Move press export, printer proof and basic e-paper into the new Phase 1. |
| 2 | `phase1-autopage.md` "Done when": "three design partners have tried it" and USABILITY_TEST recruits "2 weekly owners (not Janshakti)" | You can name 0–2 weeklies. The gate is decided by sales, not by building, and the plan never schedules the sales. | blocker | Sales track from day 1. Build gates measure every produced issue (Janshakti counts), so they never wait on sales; business gates are separate. |
| 3 | `phase1-autopage.md` tasks 0–15, 11 gates, "6–8 wks" | 15 tasks including a 12-component UI library, a11y with TalkBack/NVDA, a 20-issue corpus, lead radar, dedupe F1, usability rounds. Build capacity in the 12 weeks is about 270 h (§6); this phase alone exceeds it. | blocker | Cut to the operator tool; defer self-serve items with explicit triggers (§6). |
| 4 | `phase1-autopage.md` task 11, gate G1.fillrate | Needs 20 past Janshakti issues as "stories plus the final page order" and "what the editor actually did". Past issues exist as finished pages, not placement data; reconstructing 20 by hand is about 40+ hours (estimate). | serious | Replace with a forward-looking metric on every produced issue (G1.autoplaced). Replay corpus later, built from Studio op logs. |
| 5 | `PRODUCT_PROMPT.md` §1: "Saptahik ₹7,999/yr or ₹149/edition … phone: ₹15 per e-paper PDF, ₹99/month unlimited, Press Pro ₹799/month" vs `MobilePlans.dc.html` | Two price lists. The board leads with ₹15/₹99 and itself admits "The ₹15 e-paper tier is thin-margin". None of it was tested with a buyer. | serious | One price to discover: a per-page service rate anchored to what the local operator charges (§9). Software tiers wait for the week-12 decision. |
| 6 | `Compare.dc.html` | XLR8 "₹32,149 year 1", "80+ templates", "95–100% frame fill"; ePaper Designer "50K+ installs, 4.5 rating". The board says "checked 23 Oct 2026" but links nothing; my searches did not find either product. | minor | Mark every figure UNVERIFIED. These are not the real competitor (finding 25); a 1-hour desk check is enough before any sales claim. |
| 7 | `PRODUCT_PROMPT.md` §3 export pipeline, `phase2` task 2 | "Ghostscript converts to CMYK with a named ICC profile": Chromium text `#000` is RGB; Ghostscript's RGB→CMYK conversion turns it into four-colour black ([GS IRC 2017-10-27](https://ghostscript.com/irclogs/2017/10/27.html)), and pdfwrite reportedly cannot take an output ICC profile and intent for RGB→CMYK ([GS bug 700931](https://bugs.ghostscript.com/show_bug.cgi?id=700931)). Rich-black text on newsprint misregisters. | serious | Spike E2 in week 1 with a pass/fail on plate separations; architecture fix in §7. |
| 8 | `phase0-engine.md` task 7 (HarfBuzz probe) and task 3 (font diagnosis) | Task 7 says "only if match < 99.5%"; match is 99.7%. CLAUDE.md says "Font and engine tuning is closed." | minor | Cut both. Record in the decision log. |
| 9 | `spike/out/report.md` "weight 400", "12/14 px" | Headlines are bold and large; parity is unmeasured there. CLAUDE.md already says "Bold weights are untested". | serious | Phase 0 task: extend `spike/run.mjs` to weight 700 and 18–36 px for Khand, Eczar and Noto. `run.mjs` is a judge: Amal approves. |
| 10 | `phase1` task 12b, D-009 "lead radar … from a paid news API" | Paid API breaks the ₹5k budget, and GNews terms already forbid redistribution of API access ([GNews ToS](https://gnews.io/legal/terms-of-service)). No customer has asked for it. | serious | Defer lead radar. Keep `source` and `licence` fields (cheap, legal safety). |
| 11 | `PRODUCT_PROMPT.md` §2.9 "Multi-tenant from day one … RLS", roles | In services mode you are the only operator. Roles UI and RLS policies are effort with no user. | minor | Keep `org_id` on every record; defer roles, RLS policies and auth UI to self-serve. |
| 12 | `phase2` tasks 5, 6, 7 (phone mode, WhatsApp Business API, Razorpay) | Meta bills per delivered template message since July 2025, about ₹0.115 utility and ₹0.86 marketing in India plus BSP fees ([Meta pricing](https://developers.facebook.com/docs/whatsapp/pricing); vendor summary [baat.ai](https://baat.ai/blog/whatsapp-api-pricing-india)); template approval and a BSP are overhead for a 3-customer business. | serious | Reporters forward to an ordinary WhatsApp number you watch; payment by UPI to a known account plus a manual GST invoice. API and Razorpay at self-serve. |
| 13 | `UX_SPEC.md` §15, §13 ("12 components", "60-second Hindi video for the step", WhatsApp button on every screen) | Too much for one person before the first sale; the first users are you and an owner who approves a proof. | serious | First UI: tokens plus 5 components (Button, Toolbar, Toast with undo, Callout, PageThumb). Videos after 3 self-serve users. UX_SPEC stays binding for anything a customer touches (the proof page). |
| 14 | `PRODUCT_PROMPT.md` §2.9 Supabase; budget answer | Supabase free projects pause after about a week idle ([Supabase pricing](https://supabase.com/pricing)); a weekly cadence can hit that. Pro is $25/month plus compute (third-party summaries, verify). | minor | Local working store for the operator tool, plus public static hosting and nightly off-machine backup (§7). Supabase Pro at self-serve. |
| 15 | `PRODUCT_PROMPT.md` §4 "rni?", §5.1 "RNI imprint" | The Press and Registration of Periodicals Act, 2023 replaced the PRB Act from 1 March 2024; the registrar is now PRGI; Section 3 requires the printer, place of printing, editor, publisher and place of publication on every periodical ([PRP Act text](https://PRSINDIA.org/files/bills_acts/acts_parliament/2023/The%20Press%20and%20Registration%20of%20Periodicals%20Act,%202023.pdf); [PRGI FAQ](https://prgi.gov.in/node/1012)). | minor | Rename to PRGI; the imprint block is a required template object and a preflight rule. |
| 16 | `phase1` gate G1.time "≤ 60 min for one real weekly, recorded by hand" | Gameable: an easy issue, timed by the builder. | serious | Replaced by B.minutes on every produced issue, time from "copy received" to "press PDF sent", median of last 4, recorded by Amal with `npm run record`. |
| 17 | `harness/gates.json` | No business gates: nothing measures payment, retention, support load or founder minutes per issue. | serious | Add B-gates (§6). All hand-measured, recorded only by Amal. |
| 18 | `CLAUDE.md` decision log | D-011 is used twice (harness hardening, and the v1 font set note); the enhancement prompt says "D-009 onward" but D-009 to D-011 exist. | minor | New entries start at D-012. Do not renumber (append-only); note the duplicate. |
| 19 | `CLAUDE.md` "`/bug <symptom>` … `/review`" | `.claude/commands/` has only `task.md` and `gate.md`. `/bug` and `/review` do not exist. | minor | Propose both under `docs/proposed-automation/`. |
| 20 | `PRODUCT_PROMPT.md` §4 ops `groupIntoParent`, wrap `contour` | Ops hold for overlays and assets on assets (parentId is data, inverse is ungroup). Contour wrap breaks the "auto-pager can do it" rule only if polygon extraction lives in the engine: it is image processing, non-deterministic across decoders. | minor | Extract the polygon outside the engine at upload and store it as data; the op only references it. Contour stays deferred (Pro). |
| 21 | `PRODUCT_PROMPT.md` §1 "replaces ₹10k–40k/month of operator time" | Unsourced. It is the core value claim. | serious | UNVERIFIED. E1 and E4 ask the rate per page paid today and to whom. |
| 22 | `PRODUCT_PROMPT.md` market numbers | No reachable-market estimate. PRGI data: Hindi led with 7,968 periodicals filing statements in 2013–14, not a weekly count and not current ([PRGI chapter 7](https://prgi.gov.in/sites/default/files/2023-01/CHAPTER_07.pdf)). That is a vanity count. | minor | Reachable 12-month segment = qualified weeklies at presses you can get introduced to. Estimate: 1 press prints 5–20 periodicals (UNVERIFIED, ask in E1); 2–3 presses → 15–50 names; after qualification (finding 26) perhaps half; at a 10% close rate → **2–5 paying** (estimate). |
| 23 | DPDP | Data-fiduciary duties (notice, consent, security, breach reporting) apply from about 13 May 2027, 18 months after the Rules were notified ([PIB summary](https://static.pib.gov.in/WriteReadData/specificdocs/documents/2025/nov/doc20251117695301.pdf)). | minor | Hold minimal personal data. One-page privacy notice before self-serve; full compliance work before May 2027. |
| 24 | Content (`PRODUCT_PROMPT.md` D-009, idea 14) | "Own content only" may lose buyers who want filler. Evidence so far is only XLR8's unlinked claim. PIB reuse terms could not be read (403), so UNVERIFIED. | serious | Keep D-009. Ask the content question in every buyer conversation (E4). |
| 25 | `Compare.dc.html` and the whole positioning | Wrong competitor. For a small weekly the alternative is the local DTP operator paid per page, or the printer's in-house operator, often bundled into the print price. Nothing in the kit knows their rate. | blocker | E1 and E4 ask "rate per page today, and who does it". Price per page against that anchor (§9). |
| 26 | Market assumption (implicit) | Many small weeklies print minimal runs mainly to keep registration and government-ad eligibility; they will pay close to nothing for layout quality (UNVERIFIED, test in E4). | serious | E4 qualifying questions: print run, who reads it, where revenue comes from. Count only qualified prospects. |
| 27 | A1 in revision 1 (printer as neutral channel) | If the printer sells layout to his weekly clients, introductions take customers from him. | blocker | E1 asks first whether he does composing and at what rate. If yes, the printer is the first buyer (Studio as his operator's tool, H-P below); if no, he is the channel (H-W). |

## 3. Seed ideas: accept, reshape, defer, kill

Days are working days at 7 h/day. Values are estimates.

| # | Idea | Call | Reason | Effort | Value | Must be true |
|---|---|---|---|---|---|---|
| 1 | Unified newsroom (one story → web, print, e-paper, WhatsApp) | Reshape | Janshakti's site is on Supabase already; import its stories into the desk (read-only) instead of making Studio the CMS. | 2 d | Saves retyping for site-owning weeklies | Buyers have a website (ask in E4) |
| 2 | Printer channel | Accept, first, but test which role | The printer is either the channel (H-W) or the buyer (H-P) depending on whether he sells layout. | 2 h in E1 | 3–8 prospects per press, or one buyer with many issues | E1 answer |
| 3 | Ad marketplace / govt ad empanelment | Defer | Greetings and public-notice templates are cheap and sell (keep as templates). Marketplace needs volume. | — | — | 10+ customers |
| 4 | Reader side (paid e-paper, audio, video) | Defer except share cards | Share cards come free from the article map. | — | — | Readers ask |
| 5 | Marathi next | Defer | Same script; engine change is mainly fonts and parity on Marathi copy. Reach is the limit, not language. | 3 d later | — | Hindi has 10 customers |
| 6 | School / institution magazines | Defer, test once | Yearly cadence means low retention; a school souvenir is a good one-off services job. | — | UNVERIFIED | A school asks |
| 7 | Legacy OCR import | Kill for v1 | OCR on Devanagari scans is a research project; buyers already have text in WhatsApp or Kruti Dev. | — | — | — |
| 8 | Template marketplace | Defer | No designers, no buyers yet. | — | — | 50 customers |
| 9 | White-label for press clubs | Reshape | Press clubs are a sales venue, not a product. | 0.5 d | Leads | — |
| 10 | CMS plugin / printer RIP API | Defer | No integration demand yet. | — | — | Printer asks |
| 11 | AI assist | Defer | After self-serve. Trim-to-fit is the first candidate. | — | — | Fit fixes are a measured bottleneck |
| 12 | Publisher analytics | Defer | Needs readers. | — | — | E-paper traffic exists |
| 13 | Compliance helper (PRGI imprint) | Accept, small | Imprint block plus preflight rule. | 1 d | Trust, talking point | — |
| 14 | Content supply | Keep D-009, test demand | v1: own copy plus own-site import. (b) agency feeds: request PTI/UNI/IANS/Hindusthan Samachar rate cards (costs UNVERIFIED). (c) government releases: PIB terms unreadable, UNVERIFIED. (d) opt-in pool: needs 10+ customers and a written licence. (e) headlines plus links: discovery only, deferred with lead radar. (f) AI rewrite: does not cure copying of expression and does not change publisher terms; not legal advice; kill. Matching "400 sources" honestly needs agency contracts; not before 3 of 5 qualified buyers say they would pay (E4) and a lawyer hour. | 0 now | Unknown | E4 result |
| 15 | Onboarding and support as a product | Accept | In services mode support is the product; B.minutes and B.support measure it. | in ops | — | — |
| N1 | Kruti Dev / Chanakya → Unicode on paste | Accept, early | Daily pain; cheap; works in concierge mode. | 2 d | Wins demos | Converter tested on real copy |
| N2 | Proof link (read-only page images plus comment) | Accept | Owners approve on phone; replaces most of the approval phase. | 2 d | Retention | Public hosting (§7) |
| N3 | Printer preflight sheet ("ready for press") | Accept | Gift to the channel; or a feature if the printer is the buyer. | 1 d | Goodwill | E1 |

## 4. Assumption register (highest risk first)

| # | Assumption | Cheapest test (hours) | Kill or change result | Evidence from |
|---|---|---|---|---|
| A1 | The printer does not sell layout to his weekly clients, so he will introduce you (H-W) | First question in E1 (2 h) | He does layout: switch to H-P (printer as buyer; Studio is his operator's tool; price per page saved). He refuses both roles: second press by day 5 | Printer |
| A2 | Qualified small weeklies pay someone per page today and would pay you a comparable per-page rate | 5 conversations (10 h), E4 | Fewer than 2 of 5 qualified owners name a per-page rate, or no pilot accepted after a clean free issue: services-to-weeklies is wrong; test H-P with a second press | Owners |
| A3 | B.minutes reaches ≤ 150 by week 8 and ≤ 90 by week 12 | Concierge issue E5 (baseline), then every produced issue | Misses either checkpoint: see risk 3 | Stopwatch, `npm run record` |
| A4 | The printer accepts Chromium + Ghostscript PDFs with K-only black text | E1 spec + spike E2 (6 h) + one physical proof | Proof rejected twice for the same fault: mono-only output for v1, or printer RIP conversion | Printer, separations |
| A5 | Bold/large headline parity is as good as body text | Extend `spike/run.mjs` (4 h, judge change) | Any headline font under 99.5% or with overflows: drop it from v1 headlines | `spike/out/report.json` |
| A6 | Auto-page v0 places ≥ 60% of stories without a manual move | Count on every produced issue | Under 40% after 4 produced issues: auto-page is not the value; sell fit meters, Kruti Dev, press file and e-paper as the service | Op logs |
| A7 | Qualified buyers have readers and revenue that make layout quality worth paying for | E4 qualifying questions | Most prospects print minimal runs for eligibility only: shrink the target list; focus on weeklies with ad revenue | Owners |
| A8 | Buyers do not need supplied content to buy | Content question in E4 | 3 of 5 qualified say they would pay for licensed content: agency quotes and the lawyer hour | Owners |
| A9 | E-paper plus WhatsApp cards matters to owners | Ask in E4; demo | Nobody cares: page images only, drop article map work | Owners |
| A10 | Hours after week 12 continue | Ask yourself at week 10 | Under 15 h/week: freeze at services with the tool as is | Founder |

## 5. First 14 days (experiments before heavy building)

Build track about 4–5 h/day; sales and ops about 2–3 h/day. Each line has a pass/fail. The tracked version with an empty results column is `docs/EXPERIMENTS.md`.

| Day | Experiment | Pass / fail |
|---|---|---|
| 1 | **E1 Printer meeting.** In this order: (1) do you do composing/layout for your clients, and at what rate per page? (2) spec sheet: trim, bleed, ink limit, ICC, PDF version, colour pages per edition; (3) file types accepted today and how black text is handled; (4) how many periodicals you print; (5) depending on (1): if no layout service, ask for 5 introductions (H-W); if yes, ask whether his operator would use a tool that cuts page time, and what that is worth (H-P). | Pass: spec sheet in hand and either ≥ 3 introductions (H-W) or a trial of Studio with his operator (H-P). Fail: neither; second press by day 5. |
| 1–2 | **E3 Phase 0 finish, part 1.** `/task` Phase 0 task 5: `flow.js` to the contract. | G0.flow ≥ 17 passing, 0 skipped. |
| 2 | Write the buyer script (Hindi, §10) and the pilot offer (free first issue only; price discussed verbally). | Script reviewed by one Hindi speaker. |
| 3–4 | **E2 CMYK black-text spike.** One-page Chromium PDF: Devanagari body text in `#000`, a black rule, a coloured box with black text. First inspect how Chromium writes black: `0 0 0 rg` (DeviceRGB) or an ICC-based space (`/CS0 cs`). Routes: (a) Ghostscript `-sColorConversionStrategy=Gray` for a mono page; (b) Ghostscript `-dBlackText -dBlackVector` for a mono page (forces all text and vectors black; unusable for colour pages); (c) for colour pages, rewrite pure-black fills and strokes to DeviceCMYK `0 0 0 1` before conversion, matching both `rg` and the ICC colour-space form, then convert; (d) Ghostscript CMYK as is (control). Inspect with `gs -sDEVICE=tiffsep` and `-sDEVICE=inkcov`. | Pass: a mono route and a colour route each put text and rules on the K plate only, fonts embedded. Fail: no colour route works; v1 ships mono pages, colour pages go to the printer's RIP after asking. |
| 3–5 | **E3 Phase 0 finish, part 2.** Headline parity (weight 700, 18–36 px, Khand, Eczar, Noto) in `spike/run.mjs` (judge change, Amal approves), `flow.png`, `PHASE0_DECISION.md`. | `npm run harness -- --phase 0 --done` green; headline fonts ≥ 99.5% with 0 overflows, or failing fonts named and dropped. |
| 4–10 | **E4 Five buyer conversations** (from E1 introductions; in person or phone). Qualify first: print run, who reads it, revenue sources (ads, government ads, subscriptions). Then: who does layout today and the rate per page; time per issue; printer problems; e-paper today; "Would you pay ₹X a month for ready Hindi news you are allowed to print?"; verbal price reaction to a per-page rate near their current rate. No money asked. | ≥ 5 held; ≥ 2 qualified owners name a per-page rate; verbatim answers in `docs/PARTNERS.md`. |
| 5–6 | **E5 Concierge issue.** Build one full Janshakti issue the way it is done today (or the spike plus hand layout), stopwatch every step: copy cleanup, Kruti Dev, layout, photos, proof, fixes, export. | Baseline recorded with `npm run record`; the three slowest steps named. They reorder Phase 1 tasks after the document model (§6). |
| 7 | **E9 Desk check** (1 h): XLR8 Print and ePaper Designer price pages, screenshots saved. | Compare-board numbers either sourced or deleted. |
| 8–12 | **E6 Free first issue offer** to 2 qualified weeklies (H-W) or a trial week with the printer's operator (H-P). | 1 accepts with a date. Fail: 0 of ≥ 4 offers: revisit model (H-P if not yet tried). |
| 13 | **E8 Free first issue produced** with whatever tool exists. | Printer prints without a reprint; owner approves via proof link or WhatsApp. Only after this, ask for the paid pilot at the per-page rate. |
| 14 | Review: fill `docs/EXPERIMENTS.md`, update the assumption register, choose H-W or H-P. | Decision-log entry written. |

Dropped from revision 1: the fake-door price test and the ₹500 UPI pre-booking by WhatsApp broadcast (it contaminates E6 and reads as a scam from a stranger). Price is discovered verbally in E4; money is asked only after a free issue has printed cleanly.

Hand-measured numbers are recorded only by Amal (`npm run record -- <gate> <key>=<n> --by Amal`).

## 6. Revised phases (12-week window)

**Hours budget.** 35 h/week × 12 = about 420 h. Build at 4–5 h/day ≈ 270 h; sales and ops ≈ 150 h. From week 3, producing issues (Janshakti weekly plus pilots, 2–3 h each, 5–10 h/week) is counted as Phase 1/2 build work, because the op logs and stopwatch numbers are the data the gates use. Estimates below are mine (about 1 h per `/task` plus 30% overhead), not measured.

**Gate rule.** Build gates (G1.autoplaced, B.minutes) count every produced issue, Janshakti included; each issue is tagged paid or unpaid, and paid numbers are reported separately but not gated. Business gates (B.paid, B.retained) are sales outcomes, reported in the week-12 decision, not used to block build phases.

### Phase 0 — finish the engine (weeks 1–2, about 40 h build)
- Scope: `flow.js` plus 5 own tests; headline parity extension; `flow.png`; `PHASE0_DECISION.md`. Cut: task 3, task 7.
- Parallel: sales (E1, E4), print (E2), ops (E5).
- Gates: G0.parity, G0.guard, G0.flow (existing); new G0.headline (≥ 99.5%, 0 overflows) and G0.black (E2 separation check, 0/1, hand-recorded until scripted).
- Cut-line: `flow.png` slips to Phase 1 first.

### Phase 1 — operator tool and first produced issues (weeks 3–8, about 135 h including about 35 h of issue production)
- Order: the **document model + ops + undo (fuzzUndo) comes first**, because every later task writes ops. After it, E5's three slowest steps set the order of the rest, drawn from: Kruti Dev paste converter; 3 templates (front, inner news, ads/greetings) with the PRGI imprint; fit meters; auto-page v0 (one layout per page plus a change list, locks); minimal Guided toolbar for you (move column, resize, swap photo, send overflow); local press PDF export (route from E2); page images and a simple e-paper reader (reuse `janshakti-epaper` if its map shape fits); proof link; static publishing and nightly backup (§7).
- Out: UI library beyond 5 components, auth/roles, Supabase, dedupe, lead radar, phone mode, usability tests, WhatsApp API, billing.
- Gates: G1.fitdrift, G1.golden (unchanged); G2.pdfx and G2.proof (moved earlier); new G1.autoplaced (≥ 60% of stories with no manual move, median of last 4 produced issues); B.minutes ≤ 150 by end of week 8.
- Cut-line: drop the e-paper reader first (send page images), then the proof link (send PDF on WhatsApp). Never drop press export or backup.

### Phase 2 — paid service at small scale (weeks 9–12, whatever fits in about 95 h including about 35 h of production)
- Candidates, in priority order: whatever the op logs say is slowest; preflight subset (dpi, overflow, empty frame, imprint missing, fonts, K-only black) with G2.preflight seeded faults; printer preflight sheet; issue copy-from-last; article map and share cards.
- Ops: UPI to a known account plus manual GST invoice.
- Gates: G2.preflight; B.minutes ≤ 90 by end of week 12. Reported (not gating): B.paid, B.retained (4 consecutive paid issues), B.support (support minutes per issue; threshold set after the first month).
- Cut-line: share cards first, then article map.

### Week-12 decision (explicit, written into the decision log)
- **Go to software (Phase 3):** ≥ 3 paying customers (weeklies, or one printer counted by the weeklies he serves), B.minutes ≤ 90, and ≥ 1 owner or operator asks to do it themselves, and hours after week 12 are confirmed.
- **Stay services:** paying customers exist but either B.minutes > 90 or nobody asks to self-serve; keep producing, keep cutting minutes, re-decide at week 20.
- **Stop or pivot:** 0 paying after a clean free issue to ≥ 4 qualified prospects, or B.minutes > 150 at week 12.

### Phase 3 — self-serve (only on "go")
- Moves here from draft Phase 1/2: `packages/ui` (12 components), onboarding, Home, Supabase auth + RLS + roles, story desk for reporters, dedupe, usability rounds, a11y, phone mode, Razorpay, WhatsApp intake.
- Gates moved here: G1.firstpage, G1.usability, G1.sus, G1.a11y, G1.ux, G1.dedupe, G1.licence, G1.time (redefined: customer-built issue). G1.fillrate replay gate stays pending here, built from Studio op logs.
- Estimate: 10–14 weeks at 35 h (UNVERIFIED until hours known).

### Phase 4 (draft Phase 3 AI) and Phase 5 (draft Phase 4 Pro): unchanged content, deferred.

**Gate moves that count as loosening (rule 12, Amal approves with `npm run approve`):** G1.firstpage, G1.usability, G1.sus, G1.a11y, G1.ux, G1.dedupe, G1.licence, G1.time and G1.fillrate move from phase 1 to phase 3; G1.autoplaced (60% on produced issues) is added in phase 1 alongside. G2.pdfx and G2.proof move earlier (tightening).

## 7. Architecture changes (only those the red-team justifies)

1. **Line-breaker: Pretext is the live engine (GO).** 99.7%, 0 overflows. Drop the HarfBuzz task. Safety net: at export, a script measures each rendered line's DOM width in Chromium and fails the export if any line is wider than its frame (catches preview/print drift for any font or weight). Keep the `flow()` adapter boundary.
2. **Black text (decided by E2).** Preferred order, all UNVERIFIED until E2 runs: mono pages via Gray conversion or `-dBlackText -dBlackVector`; colour pages via rewriting pure black to DeviceCMYK `0 0 0 1` (in whichever colour-space form Chromium uses) before conversion; overprint only if the printer asks. Ink limit and ICC from the printer's sheet. Checked by `tiffsep`/`inkcov` in G0.black and G2.pdfx.
3. **Storage, hosting, backup.** Working store on local disk (issue JSON, op log, assets), with `org_id` on every record. Proof pages and e-paper are static files published to public hosting: Cloudflare Pages/R2 free tier or the existing Janshakti stack (pick in Decisions; prices UNVERIFIED). Nightly off-machine backup of issue JSON, op logs and assets (to R2 or a cloud drive), plus a written runbook (`docs/RUNBOOK.md`) for exporting an issue from a second machine, tested once before the first paid issue. Supabase Pro at self-serve.
4. **Export runs on your machine** (Node, Playwright Chromium, Ghostscript); a second machine can run it from the runbook. Container only at self-serve.
5. **Contour polygons** extracted outside the engine at upload, stored as data (deferred to Pro).
6. **PRGI imprint** is a template object type and a preflight rule.

## 8. Design backlog (minimum, in order)

Before Phase 1 ends:
1. **Proof link page** (read-only page images, tap to comment, approve): can an owner approve an issue on a phone without an account?
2. **Export and preflight checklist** (for you, then the printer sheet): does the printer accept the first file without a call?
3. **Paste-and-clean story intake** (Kruti Dev preview, source/licence pick): can a week's copy be cleaned in under 15 minutes?

Before Phase 3 (only on "go"): Brand setup (G2), Story desk (G3), Page navigator (G4), Billing (G7), Empty/error/offline (G10). Already designed: Onboarding, Help, Home. Deferred: Ad manager (G8), Approval beyond the proof link (G9), Content desk (G11).

## 9. Unit economics in INR (estimates; assumptions shown)

Assumptions: 8-page weekly, 4.3 issues/month; price per page set against the operator rate found in E1/E4 (UNVERIFIED; the scenario rates below are placeholders to be replaced by E4 data); ₹84/$ (UNVERIFIED); about 70 MB stored per issue (estimate); export local; WhatsApp by ordinary number (₹0); hosting on a free tier while small (UNVERIFIED); UPI fees UNVERIFIED (Razorpay states 2% + GST for most domestic methods; third parties say UPI is 0% ([Razorpay blog](https://razorpay.com/blog/razorpay-payment-gateway-pricing-explained/))); founder time valued at ₹1,000/h for margin only.

Cash cost per issue: about ₹5–20 for storage and hosting. Real cost is founder time.

| Scenario | Paying weeklies at week 12 | Rate per page (8 pages) | B.minutes | Revenue/month | Founder cost/month | Contribution/month |
|---|---|---|---|---|---|---|
| Conservative | 2 | ₹190 (₹1,500/issue) | 150 | ₹12,900 | ₹21,500 | −₹8,600 |
| Base | 4 | ₹250 (₹2,000/issue) | 90 | ₹34,400 | ₹25,800 | ₹8,600 |
| Strong | 5 | ₹310 (₹2,500/issue) | 60 | ₹53,750 | ₹21,500 | ₹32,250 |

Strong is capped at 5 paying, the top of the 10%-close estimate. Acquisition cost: about 6–10 founder hours per closed weekly (intro, conversation, free first issue), ₹6,000–10,000 at the assumed rate. Payback: conservative never, base about 3–5 months, strong about 1–2 months. Even the strong case is a modest business, which is why the week-12 decision exists.

Pricing: per page, because owners already think in pages and page counts vary by issue; paid after print, monthly. Skipped issues show as lower revenue, not cancellation. Annual plans only after 6 months of retention data. In H-P the price is per page of operator time saved, negotiated with the printer.

## 10. Go-to-market in 90 days

- Weeks 1–2: printer meeting (decides H-W or H-P), 5 qualified conversations, free-issue offers.
- Weeks 3–6: first free issue; paid pilot only after it prints cleanly; ask each customer for one introduction; second press via Janshakti's network; a demo at the Indore press club (UNVERIFIED venue; ask).
- Weeks 7–12: aim for 2–5 paying; printer preflight sheet as a gift to presses (H-W).
- Channel order (H-W): printer introductions → customer referrals → press club → district publisher associations. No cold broadcasts.
- WhatsApp demo: a 60-second recording of their own story turned into a page, sent after a conversation, not before.
- Buyer script opening (full Hindi script in `docs/EXPERIMENTS.md`): "आपका अख़बार कितनी प्रतियाँ छपता है और कौन पढ़ता है?" then "लेआउट अभी कौन बनाता है, और प्रति पन्ना कितना लगता है?"
- **Pilot agreement outline** (one WhatsApp message, saved in `docs/PARTNERS.md`): first issue free; then 4 issues at ₹R per page, paid by UPI within 7 days of print; customer sends copy and photos by a fixed day and time and owns all content and licences; we deliver press PDF and e-paper by an agreed time; up to 2 correction rounds; either side stops anytime; samples shown only with permission.

## 11. Working model for Claude Code

- One task, one branch, committed only when green (rule 15). The enhancement prompt suggests "parallel worktrees for independent packages"; CLAUDE.md says "Do not use superpowers' git worktrees or parallel subagents to build". CLAUDE.md wins.
- Subagents only for review: existing `reviewer`. Proposed: `hindi-typography-reviewer` (rendered output: shirorekha breaks, conjunct clipping, danda placement) and `red-team` (once per phase end).
- Proposed commands: `/bug` and `/review` (referenced in CLAUDE.md but missing), `/phase` (current phase scope, gates, cut-line).
- CI: GitHub Actions running `npm test` and `npm run harness -- --fast` on push; slow parity weekly. Proposed only.
- CLAUDE.md holds rules, commands, current phase and the decision log; phase files hold scope, tasks, gates and cut-lines. One `/task` per session; end with harness output and a commit.
- Proposals saved under `docs/proposed-automation/`; nothing in `.claude/` is changed.

## 12. Risks and kill switches

| # | Risk | Early warning | Pre-agreed decision |
|---|---|---|---|
| 1 | Printer is a competitor | E1 answer (1) is yes | Switch to H-P; find a second press for H-W |
| 2 | No reach | < 5 qualified conversations by day 21 | Pause build after Phase 0; sales only for 2 weeks |
| 3 | Minutes per issue stay high | B.minutes > 150 at week 8 or > 90 at week 12 | Week 8 miss: cut auto-page scope to fit meters + Kruti Dev + press file. Week 12 miss: "stay services" or "stop" per the week-12 decision |
| 4 | Nobody pays | 0 paid after a clean free issue to ≥ 4 qualified | Try H-P; else stop |
| 5 | Segment is eligibility-only papers | Most E4 prospects print tiny runs with no ad revenue | Narrow list to weeklies with ad revenue |
| 6 | Printer rejects files | 2 rejected proofs, same fault | Mono-only output; printer RIP conversion |
| 7 | Headline fonts fail parity | G0.headline < 99.5% | Drop those fonts |
| 8 | Laptop failure on print day | Backup job fails or runbook untested | No paid issue until backup and second-machine runbook are tested |
| 9 | Support load eats the week | B.support > 30 min/issue | Fixed copy deadline and format rule in the pilot agreement |
| 10 | Founder hours drop after week 12 | A10 | Freeze at services with current tool |

## 13. Decisions needed from Amal

1. Approve the reorder (press export into Phase 1; self-serve only after the week-12 decision). Recommend yes.
2. Approve the named gate moves (loosening under rule 12), with the new gates added at the same time. Recommend yes.
3. The week-12 decision criteria as written. Recommend yes.
4. Per-page pricing anchored to the local operator rate; no money asked before a clean free issue. Recommend yes.
5. Legal entity and GSTIN for invoices. Recommend: whatever you already invoice clients from, until 5 customers.
6. Public hosting: Cloudflare Pages/R2 or the existing Janshakti stack. Recommend the Janshakti stack if it already serves static files; otherwise Cloudflare free tier.
7. Hours after week 12: decide at week 10.
8. Decision IDs start at D-012; note the duplicate D-011 without renumbering. Recommend yes.

## Sources

- [Meta WhatsApp pricing](https://developers.facebook.com/docs/whatsapp/pricing); [baat.ai India summary](https://baat.ai/blog/whatsapp-api-pricing-india)
- [PRP Act 2023 text](https://PRSINDIA.org/files/bills_acts/acts_parliament/2023/The%20Press%20and%20Registration%20of%20Periodicals%20Act,%202023.pdf); [PRGI FAQ](https://prgi.gov.in/node/1012); [PRGI annual report chapter 7](https://prgi.gov.in/sites/default/files/2023-01/CHAPTER_07.pdf)
- [DPDP Rules PIB summary](https://static.pib.gov.in/WriteReadData/specificdocs/documents/2025/nov/doc20251117695301.pdf)
- [Ghostscript IRC on RGB black conversion](https://ghostscript.com/irclogs/2017/10/27.html); [GS bug 700931](https://bugs.ghostscript.com/show_bug.cgi?id=700931); [GS bug 700843](https://bugs.ghostscript.com/show_bug.cgi?id=700843); [pdf-tools rich black](https://blog.pdf-tools.com/2015/12/replacing-rich-black-by-true-black-in.html)
- [Supabase pricing](https://supabase.com/pricing) (via [makerkit summary](https://makerkit.dev/blog/saas/supabase-pricing))
- [Razorpay pricing explained](https://razorpay.com/blog/razorpay-payment-gateway-pricing-explained/)
- [GNews terms](https://gnews.io/legal/terms-of-service)
- UNVERIFIED: XLR8 Print and ePaper Designer facts (Compare board, no links; not found by search); PIB reuse terms (403); Ghostscript `-dBlackText/-dBlackVector` behaviour on Chromium PDFs (to be tested in E2); local operator per-page rates; periodicals per press; eligibility-only share of weeklies; exchange rate; hosting free-tier limits.
