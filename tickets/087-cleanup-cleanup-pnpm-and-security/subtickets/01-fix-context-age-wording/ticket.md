# Fix inverted age wording in CONTEXT.md

`CONTEXT.md` describes `check:deps` as flagging dependencies "older than the configured age cutoff," but the script actually fails on packages **newer** than the cutoff (published within the last N days). Correct the wording so it matches the script's `publishTime > cutoff` behavior.

## Acceptance Criteria

- `CONTEXT.md` supply-chain section describes `check:deps` as flagging packages that are **too new** / younger than the configured minimum age (or equivalent accurate wording).
- The corrected wording is consistent with `check_package_age.js`'s `publishTime > cutoff` logic.
- No other lines in `CONTEXT.md` are modified.

## Technical Specs

- **File to change:** `CONTEXT.md` (top-level, not under `game/`)
- Change the sentence "to flag dependencies older than the configured age cutoff" to accurately describe the check as flagging dependencies **newer** than the minimum age threshold.
- This is a single-line wording fix — no other changes.

## Verification: code
