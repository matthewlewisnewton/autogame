# 02 — Ice enemy client render: glacial thrower mesh + traveling ice ball

Render the new ice enemy and its slow-moving glacial ice-ball projectile on the client. The enemy
needs an icy-themed mesh preset; the traveling projectiles broadcast by the server (sub-ticket 01)
must be drawn as giant ice balls that follow their server positions and are cleaned up when they
disappear from state.

## Acceptance Criteria

- `ENEMY_GEOMETRY` in `game/client/renderer.js` has an entry for the new enemy type (the same id
  added to `ENEMY_DEFS` in sub-ticket 01) with an ice/frost color palette (e.g. light-blue / cyan,
  optional emissive), so the enemy renders with a distinct icy look rather than falling back to the
  default `grunt` mesh.
- `ENEMY_ATTACK_VISUAL` has a matching entry for the new type (ranged style) so its wind-up telegraph
  reads as a ranged attack.
- Live ice-ball projectiles from the broadcast state array (e.g. `gameState.iceBalls`) are rendered
  as a roughly spherical, large, icy-colored mesh positioned at each projectile's server `(x, y/z)`.
- The projectile meshes are kept in sync each state update: a mesh is created for a new projectile id,
  moved to follow its server position, and removed/disposed when its projectile leaves the state array
  (mirror the existing keyed-mesh-map cleanup pattern used for `enemiesMeshes`/`minionsMeshes`/`lootMeshes`).
- No leaked meshes: when a run ends or all projectiles are gone, the ice-ball meshes are disposed
  (reuse the existing `disposeMeshMap` teardown path used for enemies/minions/loot).

## Technical Specs

- `game/client/renderer.js`:
  - Add the new enemy id to `ENEMY_GEOMETRY` (~line 454) and `ENEMY_ATTACK_VISUAL` (~line 466),
    mirroring the existing entries (e.g. a `cone` or `octahedron` with frost colors).
  - Add an ice-ball mesh map (e.g. `const iceBallMeshes = {};`) near the other mesh maps
    (`enemiesMeshes`, `minionsMeshes`, `lootMeshes` ~line 103–125), a `SphereGeometry` + icy
    `MeshStandardMaterial`, and a sync routine that diffs `gameState.iceBalls` against the map by id
    (create / update position / remove) — follow the same create→update→prune shape used to sync
    enemies and minions (~line 5067+).
  - Hook the new sync into the same per-frame/state-update path that syncs enemies/minions/loot, and
    include the ice-ball map in the existing `disposeMeshMap` teardown (where `enemiesMeshes`/
    `minionsMeshes`/`lootMeshes` are disposed, e.g. `game/client/main.js` ~line 1828).
- `game/client/main.js`: if the renderer exposes the new sync/mesh map through the `getMeshMaps()` /
  window debug hooks like the other entity maps, wire it there for parity (optional but preferred).
- Use the same id key the server assigns each projectile so create/update/remove stays stable.

## Verification: code
