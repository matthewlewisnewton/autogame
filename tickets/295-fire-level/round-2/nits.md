## Remove Duplicated Arena Trials Debug Branches

`game/server/index.js` lists the `arena-trials-*` debug scenario names twice, and `game/server/debugScenarios.js` contains duplicate `arena-trials-near-adds`, `arena-trials-boss-approach`, and `arena-trials-boss-low-hp` branches where the later branches are unreachable. This is non-blocking for the fire level, but cleaning it up will make future debug scenario maintenance less error-prone.

### Acceptance Criteria
- Each `arena-trials-*` debug scenario is registered once and implemented by one canonical branch.
- Existing arena-trials debug scenario tests still pass.
