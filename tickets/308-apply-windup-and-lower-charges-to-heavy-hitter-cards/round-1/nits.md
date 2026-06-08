## Clean Up Noisy Test Fixture Errors In Coverage Logs

The coverage run passes, but `coverage.log` includes non-fatal stderr from synthetic test states, including socket-disconnect and game-loop errors about incomplete objective/enemy data. This is not a ticket blocker, but it makes future real regressions harder to spot in coverage output.

### Acceptance Criteria
- The relevant server test fixtures construct complete playing-run/objective/enemy state, or otherwise isolate teardown, so the coverage log no longer emits `[socket:disconnect] handler error` or `[gameLoop] tick failed` messages from intentionally synthetic test setup.
