## 05-suite-green

Run the full test suite after all previous sub-tickets are complete to confirm everything is green and no regressions were introduced by the seam extraction or assertion changes.

## Acceptance Criteria

- `pnpm test` (run from `game/`) completes with zero failures.
- No new test warnings or errors compared to the pre-change baseline.
- Coverage thresholds (if any are configured) are still met.

## Technical Specs

- **No code changes** — this is a verification-only sub-ticket.
- Run `cd game && pnpm test` and confirm all tests pass.
- If any test fails, diagnose whether it's a regression from sub-tickets 01-04 and file a follow-up.

## Verification: code
