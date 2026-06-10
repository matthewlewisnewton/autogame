# Client named-rare visuals (tint, scale, nameplate)

Render named-rare enemies so they read as distinct hunt targets: custom body tint and optional scale from `enemy.namedRare`, plus a floating nameplate showing the authored name. Lock-on UI should prefer the named-rare label over affix-variant badges.

## Acceptance Criteria

- When `enemy.namedRare` is present on a snapshot enemy, the renderer applies `namedRare.tint` (hex) to the enemy mesh material and scales the mesh by `namedRare.scaleMult` (default `1` when omitted).
- A dedicated enemy nameplate sprite (reuse the player nameplate canvas pattern from `createNameplate`) displays `namedRare.name` above the enemy each frame; it is created, positioned, and disposed with the enemy mesh lifecycle.
- Named-rare enemies still show the standard health bar; affix-variant badge/marker logic does not run when `namedRare` is set (no double-badge).
- `lock-on-info-panel.js` shows `namedRare.name` as the variant/title line when locking onto a named rare.
- Vitest in `game/client/test/` covers tint application, scale helper, and nameplate create/dispose keyed off `namedRare` presence (no live quest deploy required).

## Technical Specs

- **`game/client/renderer/enemySync.js`**: Add `applyNamedRareTint`, `applyNamedRareScale`, and `applyEnemyNameplate` helpers; call them from `syncEnemyMeshes` when `enemy.namedRare` is truthy, before or instead of affix `applyEnemyVariantTint` / `applyVariantMarker`.
- **`game/client/renderer/rendererState.js`**: Add `enemyNameplates` map (`enemyId → THREE.Sprite`), parallel to `playerNameplates`.
- **`game/client/renderer.js`**: Export `createEnemyNameplate` / `disposeEnemyNameplate` (mirror player nameplate helpers); wire dispose into enemy cleanup paths.
- **`game/client/lock-on-info-panel.js`**: Prefer `enemy.namedRare.name` over `VARIANT_DEFS[enemy.variant]` when building the lock-on model.
- **`game/client/test/named-rare-visuals.test.js`** (new): Unit tests for tint/scale/nameplate helpers with mocked enemy snapshots.

## Verification: code
