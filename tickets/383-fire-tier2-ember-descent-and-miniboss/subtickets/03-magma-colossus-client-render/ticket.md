# 03 — Magma Colossus client render

Give the new `magma_colossus` boss type its client-side procedural model and attack telegraph so it draws correctly in-world and through the lock-on / boss HUD. The lock-on info panel and boss-encounter HUD are already generic (driven by the server enemy catalog from sub-ticket 02), so this only needs render-registry entries.

## Acceptance Criteria

- `game/client/renderer.js` `ENEMY_GEOMETRY` has a `magma_colossus` entry — a boss-scale procedural shape (e.g. a large `cone` or `cylinder` like other wardens) with molten fire-toned `color` / `emissive` values distinct from `cinder_warden`.
- The matching attack-telegraph map in `game/client/renderer.js` (the per-type object around `cinder_warden` / `spire_warden`) has a `magma_colossus` entry whose `style` / `range` / `coneAngle` (or radial equivalent) match the server attack stats defined in sub-ticket 02.
- `game/client/models.js` `MODEL_REGISTRY` includes `magma_colossus` (set to `null`, matching the other procedurally-rendered wardens).
- A client test asserts the `magma_colossus` geometry + telegraph entries exist and the model registry maps it to `null` (mirror `game/client/test/renderer-cinder-warden.test.js`).
- `pnpm test:quick` (from `game/`) passes.

## Technical Specs

- `game/client/renderer.js`: add `magma_colossus` to `ENEMY_GEOMETRY` and the enemy attack-telegraph object, copying the nearest warden row and re-coloring/scaling for a molten colossus silhouette.
- `game/client/models.js`: add `magma_colossus: null` to `MODEL_REGISTRY`.
- Add `game/client/test/renderer-magma-colossus.test.js` (or extend an existing renderer registry test) covering the new entries.

## Verification: code
