## De-flake Arena-Trials Debug Scenario Test

`game/validation/spire-ascent/findings.md` records that a separate `test:quick` run saw an arena-trials debug-scenario test fail under full-suite ordering while passing in isolation. It is unrelated to the spire-ascent validation ticket, but it is worth isolating so future validation reports do not have to explain the same noisy failure.

### Acceptance Criteria
- The arena-trials debug-scenario test passes consistently when run alone and as part of the relevant server test suite.
- Shared debug-scenario/lobby/global state is reset between tests so `arena-trials-boss-approach` does not observe stale adds or stale objective state.
