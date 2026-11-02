# Local production measurements

This workflow prepares reviewable operator-entered measurements for `B.minutes.w8` and `G1.autoplaced`. It never records a harness result, activates a gate, or claims printer acceptance. Real issues are needed; the demonstration is entirely synthetic.

## Enter one actual produced issue

Create a JSON issue record from your own production notebook. The [separate synthetic ledger](../demos/production-log-example.json) shows complete example records inside its `issues` array; the append command takes **one issue object**, not the entire ledger wrapper. Never change an invented example's label to `real`. Populate a new record with actual observed dates, counts and durations.

Required fields:

| Field | Meaning |
|---|---|
| `id` | Stable unique issue ID, including publication and edition/date as needed. The CLI cannot replace or edit an existing ID. |
| `kind` | Explicitly `real` for actual produced issues, or `synthetic` for invented exercises. Each ledger contains one kind only. |
| `publication`, `paid` | Publication name and Boolean payment state. Include unpaid work and Janshakti; neither payment state nor publication filters the window. |
| `operator`, `measurementNote` | Who measured and how: notebook/stopwatch reference, interruptions, source timestamps and relevant uncertainty. This is an assertion, not independent verification. |
| `producedAt` | Actual issue production timestamp. It must be at or after press dispatch. A future plan or unfinished trial is not a produced issue. |
| `pageCount` | Actual positive integer page count, without scaling to an eight-page equivalent. |
| `pageSize` | Positive `widthMm`, `heightMm` and a text `basis`, such as a printer-confirmed trim or explicitly assumed development preset. |
| `copyReceivedAt`, `pressSentAt` | Actual start/end timestamps from receipt of the issue's copy to dispatch of the press PDF. Use the complete interval, including waiting, corrections and export retries. |
| `steps` | At least one measured work step. Each has a unique `name` and either nonnegative `minutes` **or** `startAt`/`endAt`. Timed steps must be within the overall interval and cannot overlap. The sum cannot exceed elapsed time. |
| `storyCount`, `stories` | Count and complete intended story roster. Every story has unique `id`, `initialPlacement` (`auto`, `manual`, `unplaced`) and a nonnegative integer `manualMoves`. |

All timestamps use ISO format with seconds and a timezone offset, for example `2026-11-02T10:30:00+05:30`. Invalid calendar dates and reversed intervals fail validation. Measured durations are operator-supplied; the program cannot establish that a stopwatch or notebook is truthful. If stopwatch steps mix with timestamped steps, the operator must check that work was not counted twice.

Record the entire story roster before the placement trial. `auto` means the auto-pager initially placed that story. An existing manual placement is `manual`, even if the auto-pager preserved it without moves. Increment `manualMoves` for every subsequent manual relocation of an auto-placed story; moving it back does not reset the counter. A manual placement with zero later moves does not count as auto-placed. Unplaced/dropped intended stories stay in the denominator. The CLI does not infer this history from the final document.

The auto-pager's proposal exposes `placements` with `storyId`, `existing` and `locked`, and a list of `unplaced` stories. These can help check the roster. `existing: true` alone is not evidence of automatic origin. Accept/undo operations and later editing still need manual observation in this initial workflow.

```bash
node scripts/production-log.mjs append MY_REAL_ISSUE.json
node scripts/production-log.mjs summary
node scripts/production-log.mjs summary --json
```

The default ledger is `.local/production/real-issues.json`. A custom `--ledger` must name a `.json` file under `.local/production/`; traversal and existing symbolic-link/junction components are refused. Store exercises in a separate file such as `.local/production/synthetic-issues.json`. A first append establishes its kind. The filename does not establish that a record is real; the explicit kind does. No destination in `harness/results/` is permitted.

## Last-four calculations

The summary validates the entire ledger, sorts all issues by `producedAt` (ID breaks exact timestamp ties), and selects the latest four **before** checking metric eligibility. Do not omit difficult issues from the ledger. Older issues are never substituted for a recent ineligible issue. All publications and paid/unpaid states remain included. There is no arbitrary publication filter.

For time, the latest four real produced issues must all have exactly eight pages. The median is the average of the middle two elapsed copy-received-to-press-sent durations. A recent four-page issue suppresses time evidence rather than being skipped or scaled. Page dimensions and their basis remain visible for review; eight pages does not certify equivalent production difficulty or the correct press settings.

There is a terminology ambiguity in the plans: the gate says “founder minutes”, while the plan-review measurement boundary is “copy received to press PDF sent”. This implementation conservatively suggests the full elapsed interval, including waiting. It reports summed **active minutes** separately for bottleneck analysis. It never silently substitutes a smaller step sum for the complete interval. The human reviewer must check the timing basis and the original notes before recording a metric. Deadline compliance is not calculated here.

For placement, the latest four real produced issues need not all have eight pages. For each issue, the numerator is stories initially placed by the auto-pager with `manualMoves === 0`; the denominator is **all recorded intended stories**. The summary takes the median of the four per-issue percentages, not a pooled percentage that gives a large issue extra weight.

Fewer than four real produced issues yields no qualifying median. Synthetic ledgers always yield no qualifying median or suggested recording command, even if they contain four apparently successful eight-page examples. Displayed raw synthetic rows are exercises only.

## Human review and recording

When a real window is eligible, the CLI prints a suggested `npm run record` command as text. Check the ledger against original observations, include the four issue IDs and timing basis in the note, replace `YOUR_NAME`, and run that command yourself if the evidence is acceptable. A reviewable value can fail the gate threshold; eligibility is not a passing result. The CLI never executes the suggestion and never changes pending gate status.

The live gates currently use `B.minutes.w8 median=NUMBER` and `G1.autoplaced pct=NUMBER`. Their thresholds and activation remain the existing harness's responsibility. Local measurements do not establish PDF/X certification, digital proof acceptance, clean printing or the week-eight deadline. Press dispatch is not equivalent to printer acceptance.

## Preservation and limits

Each append takes an exclusive sibling `.lock`, validates the previous file, rejects duplicate IDs, writes and flushes a fresh temporary file, then renames it into place. Failed validation and lock collisions preserve the existing ledger. A malformed ledger is never silently replaced. An interrupted write may leave a lock or temporary file; confirm no writer is active, preserve the files for diagnosis, then recover deliberately. The CLI never removes another writer's lock. Filesystem edits outside the CLI are not tamper-proof, and simultaneous manual edits do not honor its lock.

Keep the ledger and original notes in the planned off-machine backup alongside issue JSON and assets. This utility supplies no cloud sync, backup automation or tested second-machine recovery. Correct mistakes by preserving the original ledger and notes for review; there is intentionally no edit/delete command that can quietly improve a historical gate window.

## Checks and demo

```bash
node --test packages/production/test/*.test.js
node scripts/demo-production.mjs --check
```

The first command covers aggregation, invalid input, synthetic separation, issue selection and file preservation. The second regenerates the self-contained [plain-language demonstration](../demos/production-log.html), opens it in Chromium, verifies four rows and rejects console errors. It writes only synthetic demo artifacts, never a real ledger. The file-symlink test uses real filesystem symlinks when the platform permits them; a Windows `EPERM` means that one capability could not be exercised and is not proof that symlink handling was tested on that machine.
