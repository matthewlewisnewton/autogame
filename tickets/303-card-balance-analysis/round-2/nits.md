## Revisit Coverage Floors After Monolith Coverage Cleanup

Ticket 303 lowered the configured coverage floors to match the current full-suite baseline, which is acceptable for this ticket but leaves less headroom as a long-term quality gate. Once the large server/client monoliths are split or covered more directly, raise the thresholds again so future unrelated work cannot coast on the lower baseline.

### Acceptance Criteria
- Coverage thresholds in `game/vitest.config.js` are reviewed against the then-current full-suite coverage report.
- Any threshold increases are backed by a passing `pnpm test` run.
