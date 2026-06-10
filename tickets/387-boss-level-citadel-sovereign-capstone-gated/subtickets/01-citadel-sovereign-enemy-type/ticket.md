# Citadel Sovereign enemy type

Register the capstone stage-boss enemy `citadel_sovereign` with display name **Citadel Sovereign**, server combat stats that exceed every other live stage boss in pressure, loot tables, and client geometry/telegraph metadata so the boss can spawn and render in a boss-arena run.

## Acceptance Criteria

- `ENEMY_DEFS.citadel_sovereign` exists in `simulation.js` with a non-empty `name`, `description`, and `surfacedStats`.
- `citadel_sovereign.hp` is **420** (top of the defeat-window band per `game/docs/design.md`; do not exceed 420).
- `citadel_sovereign.attackDamage` is strictly greater than `arena_champion.attackDamage` (26) and `crucible_sovereign.attackDamage` (24).
- `citadel_sovereign.attackRange` is greater than or equal to `arena_champion.attackRange` (6.5).
- `ENEMY_CARD_DROPS.citadel_sovereign` and `ENEMY_MS_DROPS.citadel_sovereign` are defined in `config.js` with MS drop at least as high as `arena_champion` (70).
- `game/client/renderer.js` defines `citadel_sovereign` entries in both `ENEMY_GEOMETRIES` and `ENEMY_TELEGRAPHS` (distinct from `crucible_sovereign` / `arena_champion` colors).
- `enemy_display_catalog.test.js` includes `citadel_sovereign` in `ENEMY_TYPES` and the catalog build passes.
- New server test file `game/server/test/citadel_sovereign_enemy.test.js` pins the hardest-boss stat ordering above and HP ceiling.
- `pnpm test:quick` passes.

## Technical Specs

- **`game/server/simulation.js`** — Add `citadel_sovereign` to `ENEMY_DEFS`. Suggested profile: `hp: 420`, high `attackDamage` (~28), wide cone or radial style with `attackRange` ≥ 6.5, moderate `chaseSpeed`. Name: `Citadel Sovereign`; description should convey endgame citadel tyrant identity.
- **`game/server/config.js`** — Add `citadel_sovereign` to `ENEMY_CARD_DROPS` (e.g. `dungeon_drake` or another existing high-tier drop) and `ENEMY_MS_DROPS` (≥ 70).
- **`game/client/renderer.js`** — Add geometry + telegraph entries keyed `citadel_sovereign` (imposing silhouette; telegraph range must match server `attackRange`).
- **`game/server/test/citadel_sovereign_enemy.test.js`** (new) — Assert stat ordering vs `arena_champion`, `crucible_sovereign`, `glacial_tyrant`; assert `hp === 420`.
- **`game/server/test/enemy_display_catalog.test.js`** — Append `citadel_sovereign` to `ENEMY_TYPES`.

## Verification: code
