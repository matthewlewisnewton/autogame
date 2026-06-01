## Duplicate flare_beacon server test suites

`game/server/test/flare_beacon.test.js` largely overlaps the `useKeyItem — flare_beacon` block in `game/server/test/key-items.test.js`. Consolidating would reduce ~30s of redundant socket server spin-up per CI run.

### Acceptance Criteria
- Single describe block (or shared helper module) covers flare definition, in/out of radius, dead skip, cooldown, and `stateUpdate` snapshot.
- Removing the duplicate file does not reduce assertion coverage.

## No unit test for expired `revealedUntil` tick cleanup

`simulation.js` deletes `enemy.revealedUntil` when expired, but no test advances time or ticks simulation to assert the field is cleared (client tests cover local expiry visually only).

### Acceptance Criteria
- A server test sets `revealedUntil` in the past (or mocks time), runs the relevant simulation tick path, and expects `revealedUntil` to be undefined on the enemy afterward.

## Round-1 capture did not exercise flare VFX

Harness used fallback lobby/movement capture; no `?debugScenario=flare-beacon-ready` or key-item use in browser. Code verification is strong; a future capture plan could add one screenshot with revealed enemies glowing.

### Acceptance Criteria
- `metrics.json` includes at least one screenshot or probe note showing amber reveal highlight on a nearby enemy after `useKeyItem` for `flare_beacon`.
