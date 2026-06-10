# Render the new flying enemy types on the client

Give the two new flying enemy types (`void_seraph`, `rime_drifter`) client-side
visual definitions so they render as hovering bodies with ground shadows and the
correct attack-telegraph styling, matching how `ember_wraith` is rendered. Depends
on sub-ticket 01 (the server type ids must exist).

## Acceptance Criteria
- `MODEL_REGISTRY` in `game/client/models.js` has entries for `void_seraph` and
  `rime_drifter` (procedural geometry is fine — `null` path, like `ember_wraith`/`field_medic`).
- `ENEMY_GEOMETRY` in `game/client/renderer.js` has an entry for each new type
  (shape/radius/color/emissive), so a spawned enemy of either type produces a mesh.
- `ENEMY_ATTACK_VISUAL` (the attack-telegraph table in `renderer.js`) has an entry for each:
  - `void_seraph` → a `radial` style telegraph,
  - `rime_drifter` → a projectile/ice-ball style telegraph consistent with `glacial_thrower`.
- Both types render at altitude: because each carries `flying: true` + `altitude` from the
  server, `flyingRenderOffset()` lifts the body and `flyingShadowY()` drops a ground shadow —
  no client change needed beyond the geometry/visual entries; confirm no code path special-cases
  enemy type in a way that would skip the flying offset for these ids.
- A vitest client test asserts `MODEL_REGISTRY`, `ENEMY_GEOMETRY`, and `ENEMY_ATTACK_VISUAL`
  each contain `void_seraph` and `rime_drifter` (so a spawn of either does not fall through to a
  missing-geometry path).
- `pnpm test` (client suite) passes.

## Technical Specs
- `game/client/models.js`: add `void_seraph: null` and `rime_drifter: null` to `MODEL_REGISTRY`.
- `game/client/renderer.js`: add `ENEMY_GEOMETRY[...]` and `ENEMY_ATTACK_VISUAL[...]` entries for
  both ids near the existing `ember_wraith` / `glacial_thrower` / `field_medic` entries. Use
  octahedron-style hovering bodies (cf. `ember_wraith` at radius ~0.35) with distinct colors.
- Reuse the existing flying-render path (`flyingRenderOffset`, `flyingShadowY`, shadow upsert in
  the render loop) — do not add per-type Y handling.
- Test under `game/client/test/` (reference `renderer-enemy-emissive-priority.test.js` and other
  renderer/model tests for the import + assertion style).

## Verification: code
