# Server: Smoke Veil enemy targeting and strike suppression

## Description

While a player stands inside their own active Smoke Veil disc (fixed center from sub-ticket 01), enemies must not acquire them as a target and must not land a windup strike on them. Add a small shared helper and wire it into enemy AI in `simulation.js`. Document the chosen rule: **targeting cleared** (not random miss rolls).

## Acceptance Criteria

- `isPlayerInSmokeVeil(player)` (or equivalent) returns true only when `Date.now() < player.smokeVeilUntil` and horizontal distance from `(player.x, player.z)` to `(player.smokeVeilX, player.smokeVeilZ)` is ≤ `player.smokeVeilRadius`.
- In `updateEnemies()`, living players inside their smoke veil are skipped when choosing `nearestTarget` for chase/windup.
- If an enemy is in `windup` targeting a player who is inside that player’s veil at strike time, the attack is canceled (no `damagePlayer` / `damageMinion`) and the enemy returns to `chasing`.
- Enemies outside the veil behave unchanged; minion taunt logic is unchanged.
- Rule is documented in code comment: **targeting suppression inside the fixed veil disc** (not a global “smoked” buff after leaving the cloud).

## Technical Specs

- **`game/server/simulation.js`**:
  - Add `isPlayerInSmokeVeil(player)` near other combat helpers.
  - In the nearest-player loop inside `updateEnemies()`, `continue` when `isPlayerInSmokeVeil(player)`.
  - In the windup resolution block, before `damagePlayer` / `damageMinion`, if the resolved target is a player and `isPlayerInSmokeVeil(target)`, cancel to `chasing` without damage.
- **Optional (only if needed for future ranged enemy projectiles)**: In `damagePlayer`, if the victim is in a smoke veil and `options.ranged` / `options.projectile` from an enemy, skip damage — defer unless a test requires it; melee windup cancel is the primary path.

## Verification: code
