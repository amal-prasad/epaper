# Debug log

Two lines per non-obvious bug: symptom, cause. Newest first.

- 2026-10-28: Mukta parity 880n real copy. Cause: bundled fonts were Devanagari-only, so digits and English fell back to a system font that canvas and DOM resolve differently. Fix: bundle the Latin subset (spike/add-fonts.mjs).
