# Client: Frenzied variant tint and badge

Give Frenzied enemies a distinct client look on top of the generic variant badge from ticket 169: a dedicated badge color and a body tint when `enemy.variant === 'frenzied'`. Add a debug scenario that spawns a Frenzied grunt beside a plain grunt for side-by-side comparison.

## Acceptance Criteria

- When `enemy.variant === 'frenzied'`, the floating variant badge uses a red/orange-amber color distinct from magenta (`test`), cyan (`warded`), teal (`leeching`), and hot orange (`volatile`).
- When `enemy.variant === 'frenzied'`, the enemy body mesh shows a distinguishing tint (color and/or emissive via `VARIANT_MESH_TINTS` or the `applyEnemyVariantTint` pattern) that is applied and reverted without stale tint after variant clears or mesh disposal.
- Non-Frenzied enemies keep today's appearance for mesh and badge color.
- `?debugScenario=variant-frenzied` is registered in the server debug-scenario allowlists and spawns one Frenzied-tagged grunt and one plain grunt near the player in an active dungeon (mirror `variant-leeching` / `warded-enemy`).
- Existing client tests pass; extend `game/client/test/renderer-variant.test.js` (or equivalent) to assert the frenzied color constants are wired if other variants are already covered there.

## Technical Specs

- `game/client/renderer.js`: add `frenzied` entries to `VARIANT_BADGE_COLORS`, `VARIANT_MARKER_COLORS`, and optionally `VARIANT_MESH_TINTS`. Extend `applyEnemyVariantTint` (or the per-enemy sync loop near `applyVariantMarker`) to handle `enemy.variant === 'frenzied'` while preserving windup/reveal emissive bookkeeping (`_origColor` / `_origEmissive` patterns used by warded and leeching).
- `game/server/debugScenarios.js`: add `variant-frenzied` branch — spawn grunt at `player.x + 3` with `variant = 'frenzied'`, plain grunt at `player.x - 3`, freeze wander targets like other variant scenarios.
- `game/server/index.js`: add `'variant-frenzied'` to `DEBUG_SCENARIOS` and `DEBUG_SCENARIOS_WITHOUT_DEFAULT_SPAWN` alongside `'variant-leeching'`.
- `game/server/test/debug-scenarios.test.js` (if present): assert the scenario sets `variant: 'frenzied'` on one enemy.
- Depends on sub-ticket 01 for registry id `frenzied`; client only needs the serialized `variant` tag.

## Verification: code
