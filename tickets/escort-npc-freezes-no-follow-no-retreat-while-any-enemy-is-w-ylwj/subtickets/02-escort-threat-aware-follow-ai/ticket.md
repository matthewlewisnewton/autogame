# Escort follow AI: freeze only when an enemy is actually threatening the escort

Replace the escort `underAttack` check in `updateMinions` — currently `nearestEnemy && nearestDist < DETECTION_RADIUS`, which freezes the escort whenever *any* living enemy is within 8 units even if that enemy is chasing the player on the dais. The escort should keep following the nearest squad member unless a nearby enemy has line-of-sight and is actively targeting the escort minion.

## Acceptance Criteria

- In `game/server/simulation.js`, the escort branch (`minion.isEscort`, ~L3487–3524) no longer sets `underAttack` from proximity alone. An escort is considered under attack only when at least one living enemy satisfies **all** of: within `DETECTION_RADIUS` of the escort, has line-of-sight to the escort (`hasLineOfSight`), and is actively threatening the escort — e.g. `windupTargetType === 'minion' && windupTargetId === escort.id`, or the enemy would acquire the escort as its nearest minion target using the same rules as `updateEnemies` (nearest living minion with LOS within radius, compared against player targets).
- When no enemy is actually threatening the escort, follow behavior is unchanged: escort moves toward the nearest living, non-extracted squad member when farther than `MINION_FOLLOW_DISTANCE`.
- When an enemy **is** targeting the escort (place escort closer to grunt than player, grunt has LOS), the escort still holds position (does not follow) — defensive freeze preserved for real threats.
- The regression test from sub-ticket 01 (`escort follow with nearby living enemy`) passes: escort at ~(8.5,0), grunt at start-room position, player on dais → escort reaches dais and run completes `victory` while grunt remains alive.
- Existing test `escort follows the nearest living squad member when not under attack` still passes.
- `pnpm test` passes.

## Technical Specs

- **`game/server/simulation.js`**:
  - Add a helper (module-local or exported) such as `isEscortThreatened(escort, enemies, losColliders)` near the escort AI block. Reuse `DETECTION_RADIUS`, `hasLineOfSight`, and `getWallColliders()` (compute colliders once per `updateMinions` tick, same pattern as `updateEnemies`).
  - Mirror enemy acquisition logic from `updateEnemies` (~L3258–3291): for each enemy, determine whether the escort would be that enemy's chosen target (minion vs player) given LOS and distance. Only return true when the escort is the acquired target, or the enemy is mid-windup/recovery specifically against the escort minion id.
  - Replace `const underAttack = nearestEnemy && nearestDist < DETECTION_RADIUS` with a call to the new helper. Remove or repurpose the old nearest-enemy scan if the helper subsumes it.
  - Do **not** change non-escort minion AI or enemy AI in this ticket.
- **`game/server/test/escort_objective.test.js`**: Add one focused test that an escort **does** hold position when a grunt within range has LOS and the escort is the nearer target than the player (escort between grunt and player). Optional if covered implicitly by the helper logic, but preferred for regression safety.

## Verification: code
