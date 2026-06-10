## Simplify Frost Crossing Tier II Debug Deployment
The `frost-crossing-tier-2` debug scenario currently calls `enterPlayingPhase()` and then immediately clears and rebuilds the run state. This is non-blocking because the final state is correct and normal gameplay is unaffected, but it creates a transient duplicate spawn/run during debug setup.
### Acceptance Criteria
- The `frost-crossing-tier-2` debug scenario deploys directly into the final Tier II run state without creating a transient first run.
- Existing debug-scenario tests for Frost Crossing Tier II still pass.
