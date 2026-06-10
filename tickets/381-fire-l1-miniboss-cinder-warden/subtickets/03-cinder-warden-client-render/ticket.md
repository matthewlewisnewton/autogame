# Render the Cinder Warden on the client

Give the new `cinder_warden` boss type its client-side procedural model and
attack telegraph so it draws correctly in-world and through the lock-on / boss
HUD. The lock-on info panel and boss-encounter HUD are already generic (driven
by the server enemy catalog from sub-ticket 01), so this only needs the render
registry entries — no panel code changes.

## Acceptance Criteria
- `game/client/renderer.js` `ENEMY_GEOMETRY` has a `cinder_warden` entry — a
  boss-scale procedural shape (e.g. a `cone` like `spire_warden` /
  `arena_champion`) with fire-toned `color` / `emissive` values.
- The matching attack-telegraph map in `game/client/renderer.js` (the
  per-type object around `annex_overseer` / `spire_warden`, ~line 621) has a
  `cinder_warden` entry whose `style` / `range` / `coneAngle` match the server
  attack stats defined in sub-ticket 01.
- `game/client/models.js` `MODEL_REGISTRY` includes `cinder_warden` (set to
  `null`, matching the other procedurally-rendered wardens, so it uses the
  `ENEMY_GEOMETRY` primitive rather than a missing `.glb`).
- A client test asserts the `cinder_warden` geometry + telegraph entries exist
  and the model registry maps it to `null` (mirror an existing renderer/registry
  test such as `game/client/test/renderer-spike-trap.test.js` or the enemy
  geometry coverage).
- `pnpm test:quick` (from `game/`) passes.

## Technical Specs
- `game/client/renderer.js`: add `cinder_warden` to the `ENEMY_GEOMETRY` object
  (~line 604) and to the enemy attack-telegraph object (~line 621), copying the
  `spire_warden` rows and re-coloring for fire.
- `game/client/models.js`: add `cinder_warden: null` to `MODEL_REGISTRY` beside
  the other warden entries.
- Add/extend a client test under `game/client/test/` covering the new entries.

## Verification: code
