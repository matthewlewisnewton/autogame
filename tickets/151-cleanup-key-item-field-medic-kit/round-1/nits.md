## Client unit test for keyItemHealPulse handler

The lobby broadcast is covered by a server integration test, but `game/client/main.js` has no vitest that fires `keyItemHealPulse` and asserts `triggerHealPulseVFX` is called with payload coordinates/radius. A small handler test (mirroring `cardUsed` throttle tests) would guard against regressions in the client-only path.
### Acceptance Criteria
- Vitest triggers `keyItemHealPulse` with `{ x, z, healRadius }` and verifies `triggerHealPulseVFX` receives the same radius and position.
- Test confirms `keyItemUsed` success for `field_medic_kit` does not call `triggerHealPulseVFX` (no duplicate pulse).

## Heal pulse VFX floor height

`keyItemHealPulse` places the ring at `y: 0` while player positions follow sloped floors via `sampleFloorY`. On ramps the ring may sit below/above the caster visually.
### Acceptance Criteria
- Heal pulse mesh Y uses floor height at `(x, z)` (or caster `y`) consistent with other ground VFX in `renderer.js`.
