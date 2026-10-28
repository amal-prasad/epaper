# Phase 2 — Paid service at small scale

Read `CLAUDE.md`, `docs/PRODUCT_PROMPT.md` and `docs/PLAN_REVIEW.md` first. Phase 1 must pass. Weeks 9–12, whatever fits in about 95 h including about 35 h of issue production.

## Goal

Cut founder minutes per produced issue to <= 90 (median of last 4, Janshakti included) and keep 2–5 paying weeklies printing. Press export and the printer proof moved to Phase 1; this phase tightens quality and removes the slowest manual steps.

## Entry condition

Phase 1 gates pass. There is no "three weeklies agreed to pay" precondition any more: sales run in parallel from day 1, and paying customers are a business outcome reported in the week-12 decision, not a build gate.

## Candidates (priority order; take from the top until hours run out)

1. The slowest manual step in the op logs and stopwatch records.
2. **Preflight subset:** pure functions in `packages/engine` for image dpi, overflow, empty frame, imprint missing, fonts not embedded, black text not K-only. Each returns a fix-link. Seeded-fault corpus of 10 broken pages (G2.preflight >= 9/10, 0 false alarms on goldens). A script gate on every exported press PDF: fonts embedded, K-only black text (`tiffsep`/`inkcov`), bleed present, page size correct.
3. **Printer preflight sheet:** one-page "ready for press" PDF (fonts embedded, K-only black, size, bleed) sent to the printer with each file.
4. Issue copy-from-last (start next issue from last).
5. Article map and WhatsApp share cards (image + headline + link).

## Operations (no build)

UPI payment to a known account and a manual GST invoice. Reporters forward copy to an ordinary WhatsApp number. Pilots follow the agreement outline in `docs/EXPERIMENTS.md`.

## Gates

G2.preflight; B.minutes <= 90 by end of week 12. Reported, not gating: B.paid (paying weeklies), B.retained (customers with 4 consecutive paid issues), B.support (support minutes per issue; set the threshold after the first month).

## Cut-line

Share cards first, then the article map.

## Week-12 decision

See `docs/ROADMAP.md`. Go to software (`phase3-selfserve.md`), stay services, or stop, written into the decision log.

## Out of scope

Phone mode, WhatsApp Business API intake, Razorpay billing, ads manager, approval workflow beyond the proof link. All move to Phase 3 if the decision is "go".
