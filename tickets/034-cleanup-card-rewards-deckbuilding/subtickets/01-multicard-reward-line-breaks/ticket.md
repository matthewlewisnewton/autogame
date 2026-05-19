# Multi-card reward names collapse onto one line

`showRunSummary` joins multiple card reward names with `\n` and sets them via `textContent`, but `#summary-rewards-cards` lacks a `white-space` CSS property so newlines collapse into a single line.

## Acceptance Criteria
- `#summary-rewards-cards` in `game/client/style.css` sets `white-space: pre-line` (or equivalent) so that `\n`-separated card names render on separate lines.
- Multiple card names in the run summary overlay display on distinct lines (verifiable by inspecting CSS and the `textContent` assignment).

## Technical Specs
- **File:** `game/client/style.css` — add `white-space: pre-line;` to the `#summary-rewards-cards` rule (currently at line ~411).
- No changes needed in `game/client/main.js`; the `cardLines.join('\n')` logic is already correct.

## Verification: code
