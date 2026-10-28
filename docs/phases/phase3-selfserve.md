# Phase 3 — Self-serve (only on a "go" at week 12)

Read `CLAUDE.md`, `docs/PRODUCT_PROMPT.md` and `docs/PLAN_REVIEW.md` first.

## Entry condition (hard)

The week-12 decision (`docs/ROADMAP.md`) is "go": at least 3 paying customers, B.minutes <= 90, at least one owner or operator has asked to do it themselves, and Amal has confirmed hours after week 12. Otherwise stay in services (Phase 2) or stop.

## Scope

Everything the draft Phase 1 and 2 had for self-serve users, moved here:

- `packages/ui`: tokens and the 12 components of `docs/UX_SPEC.md` §15, with states, keyboard behaviour and story pages.
- Onboarding, Home, issue checklist, help hub (designs exist in `docs/design/`).
- Supabase (Pro plan) with auth, org tenancy, roles (owner, editor, reporter) and RLS by `org_id`; move the local store into it.
- Story desk for reporters; duplicate detection (`dedupe`, seeded set of 50 + 50 pairs); required `source` and `licence` per story, approval blocked when `none`.
- Usability rounds (`docs/USABILITY_TEST.md`), accessibility (`npm run ux`, TalkBack, NVDA, drag alternatives).
- Phone mode with offline drafts and browser-side image compression.
- WhatsApp Business API intake (check Meta pricing first: https://developers.facebook.com/docs/whatsapp/pricing).
- Razorpay billing with UPI, GST invoices, webhook-verified.
- Export service in a container (Chromium + Ghostscript).
- Replay corpus built from Studio op logs (G1.fillrate).
- A one-page privacy notice and DPDP review before launch (duty dates start about May 2027).

Still deferred: lead radar, content pool, agency feeds (D-009: only after 3 of 5 qualified buyers say they would pay and a lawyer hour).

## Gates (moved from the old Phase 1)

G1.firstpage, G1.usability, G1.sus, G1.a11y, G1.ux, G1.dedupe, G1.licence, G1.fillrate, G1.time (redefined as a customer-built issue). Their thresholds are unchanged. Estimate: 10–14 weeks at 35 h/week (unverified until hours are known).
