## Clean Up Passing-Test Stderr Noise
The coverage run passes, but it emits repeated server-side stack traces such as `Unknown enemy type: undefined` during integration tests and disconnect handler errors. This is non-blocking for the spherical AoE ticket, but it makes coverage logs harder to scan for real regressions.

### Acceptance Criteria
- The affected integration tests either avoid malformed enemy state while the game loop is running or explicitly contain expected fault output.
- A full test/coverage run completes without unexpected stderr stack traces from the server loop or disconnect handlers.
