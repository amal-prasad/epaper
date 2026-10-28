# Plan enhancement — run this in Claude Code plan mode (Opus)

How to run: `claude --model opusplan`, press Shift+Tab until the mode reads "plan" (or start with `claude --model opusplan --permission-mode plan`), then paste everything below the line. Plan mode is read-only, so you get a plan to approve; after approval, execution switches to Sonnet and writes the files listed under "After approval".

If the model does not switch back to Sonnet after approval, run `/model sonnet` yourself before executing.

---

## Your job

You are the principal engineer, product strategist and red-teamer for this project. Do not build anything. The kit in this repo (`CLAUDE.md`, `docs/PRODUCT_PROMPT.md`, `docs/phases/*`, `docs/HARNESS.md`, `docs/DESIGN_GAPS.md`, `docs/design/*`, `spike/`, `harness/`) is a first draft written in one sitting by someone else. Assume it has errors, blind spots and wishful numbers. Your output is an **enhanced plan** that a solo founder can actually execute, plus the evidence behind every change.

"Enhance" means: find the 20% of changes that most improve the odds of reaching paying customers and press-quality output, and delete or defer the rest. More features is not enhancement. Fewer, better-ordered bets with kill criteria is.

Think hard before answering. Use the web for facts (competitors, prices, rules, costs). Cite sources as links. Mark anything you could not verify as UNVERIFIED. Do not invent numbers.

## Step 0 — Read, then ask

1. Read everything listed above. Skim the design boards in `docs/design/` by text content; do not try to render them.
2. Run `npm run harness -- --list` and read `spike/out/report.md` if present.
3. Before planning, ask me at most **7** questions with the question tool, ranked by how much each answer changes the plan. Prefer multiple-choice with a recommended option. Skip any you can answer from the repo. Questions must cover (drop ones already answered):
   - Hours per week I can truly spend on this, and for how many weeks, given my other client work.
   - Cash runway and whether this must earn within a number of months.
   - Whether Janshakti is a pure test bed or also the first revenue.
   - How many weeklies I can personally reach this month (names, not guesses).
   - Whether I want a SaaS, a services-plus-software business, or a product sold through printers.
   - Whether the Janshakti printer relationship can be used as a channel.
   - Hard constraints: budget for infrastructure, hiring a part-time designer or Hindi proofreader, legal entity.

## Step 1 — Red-team the draft

Produce a table of problems found, each with: where (file and section), why it is wrong or risky, severity (blocker / serious / minor), fix. Check at least these, and find others:

**Market and money**
- Who is the real competitor for a small Hindi weekly: another app, or pirated CorelDRAW/InPage/Photoshop plus a cheap operator and a printer who "fixes" files? Does ₹7,999/yr beat the status quo in the buyer's head, not on a spreadsheet?
- Is the buyer the owner, the operator, or the printer? Who feels the pain and who signs?
- Are the market numbers in the draft (registered titles, school counts) a market, or a vanity count? Estimate the reachable, willing-to-pay segment in the first 12 months.
- Sales reality: relationship-driven, WhatsApp-first, small tickets. What does acquisition cost per paying weekly, and does ₹ pricing survive it? Compute payback months under three scenarios.
- Pricing: flat vs per-edition vs per-page; annual-upfront vs monthly; what happens to churn when a weekly stops printing.
- Revenue beyond subscription (ads marketplace, printer referral, templates, white-label). Which are real and which are daydreams?

**Product**
- Is "auto-page v1 with no AI" actually good enough to save an hour, or will editors fix everything by hand? What is the smallest test that shows this in two weeks?
- Which design-board features are not needed for the first three paying customers? Cut them.
- Does "every edit is an op the auto-pager can run" hold for contour wrap, assets on assets and overlays? Where does it break?
- Content: how does a one-reporter weekly fill 8 pages? Is the draft's "own content only" rule a strength (legal, trust) or a reason to lose against a competitor that supplies ready content? Quantify how many pages an average target weekly can fill from its own copy.
- Single source of truth: should the same story feed website, print, e-paper and WhatsApp (write once, publish four ways)? Is that the real moat, and does it change phase order?

**Technical**
- Pretext risk: early library, no Indic claims, Mukta missed breaks in the first run. Is the fallback plan (HarfBuzz) specified enough to switch in a week?
- Export: Chromium PDFs are RGB. Converting to CMYK with Ghostscript can turn pure black text into four-colour black, which is wrong for newsprint registration. Verify with a spike and specify the fix (K-only black for text and rules, ICC handling, ink limit, overprint). Same for knockout/overprint on coloured boxes.
- Fonts: shaping differences between canvas measurement, DOM, Chromium print and Ghostscript. Where can preview and print drift, and what test catches it?
- Justification and shirorekha, drop caps with conjuncts, mixed English, digits.
- Contour wrap: polygon extraction from cut-outs, simplification, perf on phones.
- Offline/PWA on weak networks, large image uploads, photo compression, storage cost per issue.
- Supabase RLS with org tenancy, row counts, op-log growth, snapshot strategy, export concurrency cost.
- Security, abuse and compliance: India's DPDP Act, press registration (RNI) imprint rules, photo copyright, licensing of stock assets and fonts, payment compliance (GST invoices, UPI mandates).
- WhatsApp intake: official API cost model and template approval versus a simpler path (reporters forward to a number, or a web form). Verify current pricing.

**UX**
- Read `docs/UX_SPEC.md` and `docs/USABILITY_TEST.md`. Where is the UX plan too ambitious for one person (components, states, Hindi copy, video guides, WhatsApp support)? Which parts can be cut and still feel friendly? What is the cheapest way to get the first 5 real users in front of a prototype within 14 days (clickable mockup or concierge)? Are the targets (5-minute first page, SUS 75, 4 of 5 unaided) plausible?

**Plan**
- Are the time estimates (1–2, 6–8, 4–6, 3, 6 weeks) believable for one person with other work? Re-estimate at my real hours.
- Are the gates measurable and honest? Which can be gamed? Which are missing (e.g., retention, willingness to pay, support load)?
- What is the order that gets a paying customer soonest, even if the architecture is uglier? Compare to the draft's order and say which wins and why.

## Step 2 — What else can be done

Evaluate these seed ideas. Accept, reshape, defer or kill each, with a one-line reason, estimated effort in days at my hours, expected value (rupees or customers), and what must be true. Then add ideas I did not list.

1. Unified newsroom: one story record published to website, print, e-paper and WhatsApp (Janshakti's site already runs on Next.js + Supabase).
2. Printer channel: partner presses resell, get a dashboard of their customers' jobs, and receive preflighted files; revenue share.
3. Ad marketplace: booking links, greeting-ad templates, public notices, government ad rate cards and empanelment help; commission model.
4. Reader side: paid e-paper subscriptions, archive search, per-article share cards, audio read-aloud, push notifications, short vertical video from a page.
5. Marathi next (also Devanagari, large market) before other scripts; then Gujarati, Bengali, Tamil. What changes in the engine per script?
6. School and institution magazines; coaching-institute newsletters; society and company house magazines; wedding and event souvenirs.
7. Legacy import: scan or PDF of old issues into editable stories (OCR), to prove value on day one.
8. Template and asset marketplace with revenue share to designers.
9. White-label for state or district press clubs and journalist unions.
10. Plugin to existing CMS or WordPress sites; API for printers' RIP workflow.
11. AI later: trim to fit, headline options, cutlines, proof assist, translation between Hindi and English editions, all approval-based.
12. Analytics for publishers: which articles are opened and shared, to price ads.
13. Compliance helper: RNI imprint, declaration, ABC/audit-friendly circulation records.
14. **Content supply (competitor gap).** XLR8 Print advertises "400+ news sources" with auto-selection by priority and de-duplication, included in its paid plans (its homepage also says 320+, and states no licence terms for the pool). A small weekly with one or two reporters cannot fill 8 pages, so content supply may matter more to buyers than layout. Evaluate, with sources and legal caveats (not legal advice): (a) own-site and reporter copy only; (b) licensed agency feeds (cost per month, minimum commitments); (c) government releases that permit reuse with attribution (PIB, state information departments; verify terms); (d) a customer-to-customer syndication pool where papers opt in and share stories under a written licence; (e) headline-plus-link aggregation versus full text; (f) AI summarisation or rewrite of facts, and what rewriting does and does not fix legally (Indian copyright law, pending cases on news reuse, publisher ToS). Recommend one path for v1, what it costs, and what it would take to match "400 sources" honestly. Known evidence so far (verify and extend): GNews API's own terms say article text and images "remain the property of their respective owners", grant no licence to them, allow commercial use only under an active paid subscription, and prohibit redistributing, reselling or sublicensing API access without written consent (https://gnews.io/legal/terms-of-service, sections 3.1, 3.2, 5.2, 6.2). So paying an aggregator API is not buying republication rights, and a revenue share to GNews would not reach the publishers. Candidate model to test: a priced Content add-on whose wholesale cost is paid to parties who can actually license (news agencies such as PTI, UNI, IANS, Hindusthan Samachar: request current rate cards; opt-in publishers; government releases with stated terms), plus a "lead radar" that shows headlines and links as story tips for reporters to verify and write themselves (discovery, not republication). Janshakti already dropped GNews and Patrika RSS for ToS reasons; do not repeat that. Recommend getting one hour of advice from an Indian media/IP lawyer before any content feature ships.
15. Training, onboarding and support as a product: a 30-minute onboarding call, WhatsApp support, Hindi video guides. Is support the real cost of sale?

## Step 3 — The enhanced plan

Deliver, in this order, as the plan to approve:

1. **Verdict** (5 lines): is the draft plan right, wrong-ordered or wrong? What changes most.
2. **Assumption register**: every load-bearing assumption, how to test it cheaply (hours, not weeks), the result that would kill or change the plan, and who/what provides the evidence. Order by risk.
3. **First 14 days**: a day-by-day list of experiments that run before heavy building: Phase 0 spike on real copy, CMYK black-text spike, five buyer conversations with the script, a paid pilot offer to two weeklies, a fake-door test of pricing, a manual concierge issue (build one issue by hand with the tools, time it), and in every buyer conversation the content question: "Would you pay ₹X a month for ready Hindi news you are allowed to print?" (draft decision D-009 stands unless this evidence or a lawyer says otherwise). Each with a pass/fail line.
4. **Revised phases**: for each phase, scope (smaller than the draft), calendar weeks at my real hours, parallel tracks (build / design / sales / ops), dependencies, gates (add business gates: paying customers, retention, support hours), and explicit cut-lines ("if behind, drop X first").
5. **Architecture changes**: only those justified by the red-team. Include the fallback decision for the line-breaker and the export black-text fix.
6. **Design backlog**: the minimum set of new screens to design before Phase 1 and Phase 2, in order, each with the one question it answers.
7. **Unit economics in INR**: price points, cost per issue (infra, storage, export, WhatsApp, support), margin, payback, three scenarios (conservative / base / strong) with the assumptions shown.
8. **Go-to-market in 90 days**: who, how, in what sequence, with scripts and offers that fit relationship-driven Indian SME sales (WhatsApp demos, printer introductions, local press-club meetings, a free first issue). Include a pilot agreement outline.
9. **Working model for Claude Code**: how to split work (subagents with defined roles such as Hindi-typography reviewer, red-team, gate-keeper; parallel worktrees for independent packages), what to automate (CI running `npm run harness`, pre-commit checks, a `/phase` and `/gate` slash command), what goes in `CLAUDE.md` versus phase files, and how to keep sessions short and recoverable. Propose the files; do not create settings or hooks that change my machine without asking.
10. **Risks and kill switches**: top 10 risks, early-warning signals, and the pre-agreed decision to pivot, pause or stop.
11. **Decisions needed from me**: a short list, each with your recommendation.

Be blunt. Lead with flaws. No filler, no hedging where there is no real risk. If a question cannot be answered without evidence, say what evidence and how to get it.

## Evidence rules

- Every external fact has a link, or is marked UNVERIFIED.
- Every number in the plan is either from `harness/results/`, from a cited source, or labelled as an estimate with its assumptions.
- When you disagree with `docs/PRODUCT_PROMPT.md`, say so and quote the line.
- Prefer a small experiment over a long argument.

## After approval (execution mode)

Write or update, in this order, and show a diff summary:
1. `docs/PLAN_REVIEW.md` — the full approved plan, with sources.
2. `docs/ROADMAP.md` — calendar view, tracks, cut-lines.
3. `docs/EXPERIMENTS.md` — the 14-day list with pass/fail criteria and an empty results column.
4. `docs/phases/phase*.md` — edit scope, estimates and gates to match; keep each self-contained.
5. `harness/gates.json` — add the new business and technical gates (status `pending` unless there is already a measurement).
6. `CLAUDE.md` — new decision-log entries D-009 onward; update "Current phase" and "Open questions".
7. `docs/DESIGN_GAPS.md` — reorder by the new design backlog.
8. Proposed (not applied) `.claude/agents/*.md`, `.claude/commands/*.md` and CI workflow, saved under `docs/proposed-automation/` for my review.

Then stop and tell me the three things to do next.
