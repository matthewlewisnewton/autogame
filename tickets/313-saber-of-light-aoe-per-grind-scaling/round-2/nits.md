## Stabilize Canyon Boss Low-HP Debug Test Event Ordering

The visibility coverage run had one unrelated failure in `server/test/debug-scenarios.test.js`: the live game state had the Canyon Descent miniboss at 1 HP, but the awaited `stateUpdate` assertion observed a prior 300 HP packet. This appears to be test event ordering/stale packet handling rather than a gameplay failure, and it is worth tightening so future coverage logs stay clean.

### Acceptance Criteria
- The `canyon-descent-boss-low-hp` debug scenario test waits for the state update produced by that scenario, not an earlier queued update.
- The full server test suite no longer reports the stale `bossUpdate?.hp` mismatch for this scenario.
