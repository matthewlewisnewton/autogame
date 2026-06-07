# Clear in-flight ice balls on run-exit cleanup

In-flight ice-ball projectiles are not cleared when a run ends, so
`resetTransientRunState()` leaves stale `_gameState.iceBalls` that
`buildWorldSnapshot()` keeps broadcasting — leaking projectile state and client
meshes into lobby or next-run snapshots. Clear `iceBalls` on run exit.

## Acceptance Criteria

- `resetTransientRunState()` clears `_gameState.iceBalls` (to an empty array)
  alongside the existing transient state (enemies, minions, loot, areaEffects,
  telepipe).
- After a run is left via suspend/return-to-lobby/give-up, the broadcast world
  snapshot's `iceBalls` array is empty (no stale projectiles survive into lobby
  or the next run).
- A server test proves that with one or more live ice balls in `_gameState`,
  running the run-exit cleanup path results in `buildWorldSnapshot().iceBalls`
  being empty.

## Technical Specs

- `game/server/progression.js`: In `resetTransientRunState()` (around line 2903),
  add `_gameState.iceBalls = [];`. Confirm `buildWorldSnapshot()` (around line
  2966) then broadcasts the empty array.
- `game/server/game-state.js`: No change expected (`iceBalls: []` already in the
  initial state) — verify the field stays consistently an array.
- `game/server/test/ice_enemy.test.js`: Add a cleanup test that seeds
  `_gameState.iceBalls` with a projectile, invokes the run-exit cleanup (the same
  exported path the existing suspend/give-up tests use), and asserts the
  resulting snapshot's `iceBalls` is empty.

## Verification: code
