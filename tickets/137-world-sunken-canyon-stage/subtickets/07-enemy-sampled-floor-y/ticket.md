# Enemy Y from sampled floor height

Sunken-canyon enemies are placed in plateau/canyon X/Z bands but use flat legacy ground height, so the required plateau threat appears below the upper band in server state and client visuals. Enemies must sit on the walkable surface from `sampleFloorY()` at their position, matching player floor-follow behavior on sloped layouts.

## Acceptance Criteria

- `spawnEnemy()` (and any layout-aware respawn path) sets `enemy.y` from `sampleFloorY(layout, x, z) ?? DEFAULT_FLOOR_Y` when `_gameState.layout` is present.
- When an enemy’s `x`/`z` changes in simulation (wander, knockback, spawner adds), `enemy.y` is refreshed from `sampleFloorY` for the new position.
- Client `renderer.js` positions enemy meshes, health bars, hitbox overlays, lock-on rings, attack telegraphs, and hit sparks using the enemy’s floor height (`enemy.y` when present, else `sampleFloorY(layout, enemy.x, enemy.z)`), not fixed `GROUND_OVERLAY_Y` / `halfHeight`-only placement.
- For `layout.stage === "sunken-canyon"` with a fixed seed: at least one spawned enemy on the plateau band has `enemy.y` within 0.25 units of `sampleFloorY(layout, enemy.x, enemy.z)` and strictly greater than canyon-center floor Y + 4 (proves it is on the upper band, not the canyon floor).
- Existing sunken-canyon spawn distribution tests still pass; add or extend unit tests for `enemy.y` on plateau vs canyon.

## Technical Specs

- **`game/server/progression.js`**: in `spawnEnemy`, read `_gameState.layout`, call `sampleFloorY` from `../shared/floorSampling.js`, assign `enemy.y`; add a small helper (e.g. `syncEnemyFloorY(enemy)`) reused after spawn.
- **`game/server/simulation.js`**: after enemy displacement updates `enemy.x`/`enemy.z`, call the floor-Y sync helper so runtime movement stays on slopes.
- **`game/client/renderer.js`**: in enemy mesh sync, telegraph/lock-on/hitbox updates, derive `floorY` per enemy from `enemy.y` or `sampleFloorY(layout, enemy.x, enemy.z)`; place mesh at `floorY + halfHeight`, overlays at `floorY + overlayOffset` (same pattern as player spawn floor handling).
- **`game/server/test/server.test.js`** (sunken-canyon enemy spawning block): assert plateau-band enemy `y` matches `sampleFloorY` and exceeds canyon floor sample by a margin.
- Optional **`game/client/test/`** smoke only if a lightweight renderer helper is extracted; server tests are the primary gate.

## Verification: code
