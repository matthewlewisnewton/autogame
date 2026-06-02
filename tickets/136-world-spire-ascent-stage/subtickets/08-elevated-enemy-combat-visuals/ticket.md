# Elevated Enemy Combat Visuals

Fix client rendering so enemies, their health bars, lock-on rings, hitbox overlays, and attack telegraphs sit on the sampled floor at `(enemy.x, enemy.z)` on tiered layouts (especially `spire-ascent`), instead of at flat-world `halfHeight` / `GROUND_OVERLAY_Y`.

## Acceptance Criteria

- In the enemy sync loop, each enemy mesh `position.y` equals `sampleFloorY(layout, enemy.x, enemy.z) + enemyMeshHalfHeight(enemy.type)` (with `DEFAULT_FLOOR_Y` fallback when sampling returns null), matching how the local player mesh uses floor Y on slopes.
- Enemy health bars, lock-on rings, radial/cone attack telegraphs, and enemy hitbox overlay groups use the same sampled floor Y (plus existing small offsets), not the constant `GROUND_OVERLAY_Y`.
- On a spire-ascent layout fixture where the summit treasure tier floor Y is ≥ 8 units above `DEFAULT_FLOOR_Y`, a unit test asserts the computed enemy world Y for a position on that tier is ≥ 8 (not ~0.5–2).
- Flat default-grid layouts behave as before: sampled floor Y at enemy XZ remains `DEFAULT_FLOOR_Y`, so enemy visuals do not regress on non-tiered dungeons.
- Existing client renderer and dungeon tests pass under `pnpm test:quick`.

## Technical Specs

- **Files:** `game/client/renderer.js` (primary), `game/client/test/renderer.test.js` or `game/client/test/dungeon.test.js` (new assertions).
- **Helper:** Add a small exported or module-local helper, e.g. `enemyFloorY(layout, x, z)` → `sampleFloorY(layout, x, z) ?? DEFAULT_FLOOR_Y`, reused everywhere enemy Y is set.
- **Touch points:** enemy mesh sync (~2812), `createHealthBarMesh` / health bar reposition, `syncLockOnRing`, `createEnemyAttackTelegraph` / `updateEnemyAttackTelegraph`, enemy hitbox mesh sync, and `spawnHitSpark` Y when it uses `halfHeight` without floor sampling.
- **Layout access:** Use `gs.layout` already available in the render tick; pass `layout` into telegraph helpers where needed.
- **Do not change** server spawn XZ distribution or quest defs — server already places summit enemies on the treasure tier; this ticket is presentation only.
- **Optional (only if needed for hit sparks):** `game/server/progression.js` — no change expected unless another subsystem reads `enemy.y` (currently unused).

## Verification: code
