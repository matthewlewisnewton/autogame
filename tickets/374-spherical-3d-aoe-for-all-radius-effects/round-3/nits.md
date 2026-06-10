## Clean Up Card Windup Test Disconnect Error Noise

The coverage run passes, but `coverage.log` includes two `[socket:disconnect] handler error` traces from `card_windup_resolution.test.js` where a partial test run state reaches `isRunObjectiveComplete()` without a complete objective shape. This is non-blocking for the spherical AoE ticket, but cleaning it up would keep stderr focused on real failures.

### Acceptance Criteria
- `card_windup_resolution.test.js` no longer emits `[socket:disconnect] handler error` during the coverage run.
- Either the test fixture supplies a valid run objective or the disconnect/terminal-state path safely ignores incomplete test-only run state.
