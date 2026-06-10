# 05 — Dragon's Breath lingering DoT uses 3D cone ticks

The initial `dragons_breath` burst is height-aware via tilted aim, but the spawned area effect drops vertical data and `updateAreaEffects()` calls `collectConeHits()` without `originY`/`dirY`, so lingering DoT ticks revert to flat XZ cones. Thread the caster's world height and aim direction through the spawned effect and into tick resolution.

## Acceptance Criteria

- `spawnDragonsBreathEffect()` stores `originY`, `dirY` (and existing `dirX`/`dirZ`) on the pushed `dragons_breath` area-effect record.
- `handleUseCard` `dragons_breath` branch passes `getEntityWorldY(player)` and `aim.dirY` (via `projectileCollectorVertical(aim)` or equivalent) into `spawnDragonsBreathEffect()`.
- `updateAreaEffects()` `dragons_breath` branch calls `collectConeHits()` with `{ originY: effect.originY, dirY: effect.dirY }` so lingering ticks use the same 3D cone as the initial burst.
- `game/server/test/spherical_aoe_cards.test.js` adds height cases for **lingering DoT ticks** (not just the initial burst): an elevated in-sphere enemy takes damage on tick; an elevated out-of-sphere enemy at the same `(x, z)` does not.
- Existing `dragons_breath` initial-burst tests and flat-ground card tests continue to pass.

## Technical Specs

- `game/server/simulation.js`:
  - Extend `spawnDragonsBreathEffect(originX, originZ, dirX, dirZ, cardDef, ownerId, options = {})` to accept/store `originY` and `dirY` (default via `resolveRadialOriginY` / `0`).
  - In `updateAreaEffects()`, branch `dragons_breath` separately from the generic cone `else` and pass stored vertical fields into `collectConeHits`.
- `game/server/cardEffects.js`:
  - After computing `aim` for `dragons_breath`, call `spawnDragonsBreathEffect(..., { originY: getEntityWorldY(player), dirY: aim.dirY })` (or pass explicit args matching the updated signature).
- `game/server/test/spherical_aoe_cards.test.js`:
  - Add tests that cast `dragons_breath`, advance `lastTickAt` past `dotIntervalMs`, call `updateAreaEffects()`, and assert in-sphere/out-of-sphere height behavior on the lingering tick.

## Verification: code
