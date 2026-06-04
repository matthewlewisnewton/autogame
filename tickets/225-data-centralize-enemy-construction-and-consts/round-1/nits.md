## Use Spawn Helper In Run-Exhausted Debug Fixture

The `run-exhausted` debug scenario still hand-constructs a terminal-state enemy object instead of using `spawnEnemy()`. It does not block this ticket because the scenario immediately marks the run failed before enemy AI runs, but using the central helper would keep all debug fixtures aligned with the new enemy construction contract.

### Acceptance Criteria
- The `run-exhausted` debug scenario creates its remaining enemy through `spawnEnemy()` or includes the same self-describing fields as a spawned grunt.
- Existing `run-exhausted` integration coverage still passes.
