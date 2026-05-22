# Cleanup deterministic review file recovery

> **Staleness note.** This follow-up ticket was written against commit
> `cbf7fe6` (2026-05-22). The codebase may have moved on since it was filed —
> before acting, re-check every file path and code reference below
> against the CURRENT code, and skip any nit that is already resolved.

Top-level review recovery currently asks qwen to copy `review.md`, `gaps.md`, and `nits.md` out of a reviewer transcript before falling back to a deterministic extractor. Since qwen is the smallest and most failure-prone model in this loop, make transcript recovery deterministic first and reserve model involvement for cases a parser genuinely cannot handle.

## Difficulty: medium

## Code references

> The references in this section were reviewed at commit `cbf7fe6`; verify them against the current code before editing.

- `harness/run_ticket.sh` `recover_review_files()` logs `review.md missing — invoking qwen extractor` and calls `qwen_extract_review_files "$t" "$d"` before trying `extract_file_block`.
- `harness/lib.sh` `qwen_extract_review_files()` trims a reviewer transcript, builds a prompt, and calls qwen just to write three markdown files that usually appear as fenced blocks in the transcript.
- `harness/lib.sh` `extract_file_block()` already implements a deterministic fallback for fenced blocks preceded by `` `review.md` ``, `` `gaps.md` ``, or `` `nits.md` `` markers.

## Acceptance Criteria

- Common reviewer transcript formats are recovered without invoking qwen.
- Recovery still handles missing optional files, especially no-nit PASS reviews, without creating false failures.
- If model-assisted recovery remains, it is clearly a last resort with logs that explain why deterministic recovery was insufficient.

## Technical Specs

- Likely files: `harness/run_ticket.sh`, `harness/lib.sh`, and any lightweight harness tests or fixtures that can exercise transcript recovery.
- Add fixtures for at least the transcript shapes described in the existing comments: filename marker plus fenced block, markdown heading plus fenced block, and transcript with only `review.md`.
- Preserve the rule that existing non-empty review files are never overwritten during recovery.

## Verification: code
