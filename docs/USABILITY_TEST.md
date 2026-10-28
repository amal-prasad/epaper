# Usability test protocol

Run this on the Guided/AutoPage build at the end of Phase 1 (and a smaller version on every big UI change). Five people, 45 minutes each. It decides G1.firstpage, G1.usability and G1.sus (`docs/UX_SPEC.md` §14). Record results in `harness/results/` and notes in `docs/PARTNERS.md`.

## Who to recruit (5)

1. Weekly owner or editor (not you, not Janshakti staff) — 2 people
2. DTP operator from a local press — 1
3. School teacher or principal who edits a magazine — 1
4. Someone over 55 who uses WhatsApp daily but no desktop software — 1

Offer a free first issue, not cash. Meet in their office, on their own device if possible. Hindi session, no English prompts. Two people in the room: one talks, one writes.

## Rules for the facilitator

- Say: "We are testing the software, not you. If something is confusing, that is our fault."
- Ask them to think aloud. Do not help for 60 seconds after they stall; then give one hint and record it.
- Never explain a button before they try it. Never say "just click…".
- Record: task success (unaided / with 1 hint / failed), time, errors, wrong clicks, words they use for things, moments of hesitation, any sign of worry ("will this delete?").

## Tasks

| # | Task (read aloud, in Hindi) | Success | Time cap |
|---|---|---|---|
| T1 | "You just signed up. Show me your front page." | Sees the sample first page unaided | 5 min |
| T2 | "Replace the lead story with this text from WhatsApp." (old-font text provided) | Pasted, converted, placed | 5 min |
| T3 | "Add this photo to the story and make the text go around it." | Photo placed, wrap chosen | 5 min |
| T4 | "The story is too long. Fix it." | Uses a fix button (trim, next page, or smaller photo) | 4 min |
| T5 | "Put a highlight box with three points in the middle." | Box added with text | 4 min |
| T6 | "You made a mistake. Go back." | Uses undo | 1 min |
| T7 | "Is this ready for the press? How would you know?" | Opens the check, understands the result | 3 min |
| T8 | "Send this to the press and share a story on WhatsApp." | Reaches export and share | 5 min |

Add T9 for the phone build: "Fill slot 2 with a photo from your camera."

## After the tasks

1. Ask: "What was the most confusing moment? Was there anything that felt scary?" Write the answer verbatim.
2. Ask them to name each toolbar button from memory of what it did, then compare with our label.
3. SUS: give the standard 10-item System Usability Scale, translated into Hindi by a native speaker and back-translated to check. Score as usual.
4. Ask: "Would you use this for your next issue? What would stop you? What would you pay?" Record the price they say first.

## Scoring

- Task success rate per task and overall; time per task; hint count.
- G1.firstpage: T1 under 5 minutes for 4 of 5.
- G1.usability: at least 4 of 5 finish T2 to T6 unaided.
- G1.sus: mean at least 75.
- "Fear count": number of times someone hesitated because they were afraid to lose work or break something. Target zero by the second round.

## Fix loop

Within two days: list every failure, group by cause (wording, hidden control, too many choices, missing undo, slow), fix the top five, and retest with two new people. Log each change as a decision-log line. Stop at 4 of 5 success on two consecutive rounds.

## Automated companion

`npm run ux` (`harness/ux/ux-lint.mjs`) checks the rules that a script can: one primary button, toolbar size, touch-target size, text size, focus visibility, language attributes, consistent help link, alt text, and axe violations. Human testing still decides everything else.
