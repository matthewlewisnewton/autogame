# Fix archive-wyrm-elevated-breath debug scenario

The `archive-wyrm-elevated-breath` debug shortcut must seed an elevated target using the normal airborne/floor model, not a grounded grunt with a manually raised `y` that `updateEnemies()` floor-snaps every tick. Keep the scenario's intent: a flying Archive Wyrm at `(x, z)` must tilt breath upward to hit a higher target on the same column.

## Acceptance Criteria

- `archive-wyrm-elevated-breath` no longer sets `elevated.y = floorY + N` on a non-flying enemy.
- The scenario's target enemy uses a **stable** elevated state: either `flying: true` with `altitude` strictly above `CARD_STATS.ancient_wyrm.altitude`, or a position on legitimate vertical layout geometry whose `sampleFloorY` supplies the height (no manual `y` override on grounded enemies).
- After `updateEnemies()` and `updateMinions()` run, the target's resolved world Y remains above the Archive Wyrm's resolved world Y at the same `(x, z)` (breath still aims upward).
- The pre-spawned flying Archive Wyrm minion in the scenario is unchanged (`flying: true`, card `altitude`).
- A server unit test applies the scenario fixture (direct `applyDebugScenario` call or equivalent) and asserts the elevated target survives simulation Y resolution without being floor-snapped to ground level.
- Existing `ancient_wyrm` / `height_aware_projectiles` / airborne tests remain green; `archive-wyrm-combat` scenario behavior is unchanged.

## Technical Specs

- **`game/server/debugScenarios.js`** (`archive-wyrm-elevated-breath` branch, ~line 3242):
  - Replace `spawnEnemy(..., 'grunt')` + `elevated.y = floorY + 5` with a flying target at `(wyrmX, wyrmZ)`. Recommended: spawn `ember_wraith` (inherits `flying` from `ENEMY_DEFS`) and set `altitude` to a value **greater than** `CARD_STATS.ancient_wyrm.altitude` (e.g. `5`), **or** spawn any enemy type and explicitly set `flying: true` + `altitude` from the def spread pattern used elsewhere.
  - Do **not** assign `elevated.y` manually; let `resolveEntityY` set it on the next tick.
  - Keep high `hp`/`maxHp`, idle `wanderTarget`/`attackState`, player offset, and the pre-seeded flying `ancient_wyrm` minion as today.
  - Update the scenario comment to document that the target is airborne via `flying`/`altitude`, matching normal gameplay invariants.
- **`game/server/test/ancient_wyrm.test.js`** (or a small focused debug-scenario test beside it):
  - Add a case that builds minimal lobby/state, calls the debug scenario helper for `archive-wyrm-elevated-breath`, runs `updateEnemies()` + `updateMinions()`, and asserts:
    - `state.enemies[0].flying === true`
    - `getEntityWorldY(enemy) > getEntityWorldY(minion)` (upward breath geometry preserved)
    - `enemy.y` is not equal to bare `floorY` at `(enemy.x, enemy.z)`
- **`game/server/index.js`**: no change expected (scenario name already registered); touch only if the allowlist comment needs alignment.

## Verification: code
