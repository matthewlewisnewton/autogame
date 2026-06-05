# Distinct Plaza Miniboss Visuals

Give the new `arena_champion` plaza boss a visually distinct presentation so it
reads as a unique miniboss rather than a recolored generic enemy. The boss must
render with its own geometry/scale/color and attack telegraph, distinct from the
generic `miniboss`.

## Acceptance Criteria

- `arena_champion` has an entry in the client `MODEL_REGISTRY` (models.js) — a
  model path (e.g. `'/models/arena-champion.glb'`) or `null` for procedural-only.
  `modelPathFor('arena_champion')` returns that value (not `undefined`).
- `arena_champion` has an `ENEMY_GEOMETRY` entry in renderer.js that is visually
  distinct from `miniboss` (e.g. larger radius/height and a different `color`),
  so it renders as a bigger, distinct silhouette.
- `arena_champion` has an `ENEMY_ATTACK_VISUAL` entry in renderer.js whose shape
  matches the server `ENEMY_DEFS.arena_champion` `attackStyle`/`attackConeAngle`/
  `attackRange`, so its windup telegraph mirrors its server-side attack.
- The enemy half-height / geometry lookup helpers in renderer.js resolve
  `arena_champion` to its own geometry (not the `grunt` fallback).
- Any client registry/geometry tests that enumerate enemy types (e.g.
  `client/test/models-registry.test.js`,
  `client/test/renderer-registry-normalize.test.js`) include `arena_champion`
  and pass.
- `pnpm test` (server + client vitest) passes.

## Technical Specs

- `game/client/models.js`: add `arena_champion` to `MODEL_REGISTRY` in the enemy
  types block (alongside `miniboss`). Use a `/models/arena-champion.glb` path or
  `null` for procedural-only; if a path is used and no asset is shipped,
  `loadModel` already falls back to the procedural mesh on load failure.
- `game/client/renderer.js`: add an `arena_champion` entry to `ENEMY_GEOMETRY`
  (distinct `type`/`radius`/`height`/`color` from the `miniboss` cone — make it
  noticeably larger) and to `ENEMY_ATTACK_VISUAL` (mirroring the server
  `attackStyle`; if the server boss uses a cone, supply `coneAngle`/`range`/
  `color`/`emissive`). Confirm the `enemyHalfHeight`/geometry helpers near the
  bottom of renderer.js pick up the new key.
- Keep server/client attack shape in agreement with sub-ticket 01's
  `ENEMY_DEFS.arena_champion` so the telegraph matches the real hitbox.
- Update or extend the client enemy-type enumeration tests
  (`game/client/test/models-registry.test.js`,
  `game/client/test/renderer-registry-normalize.test.js`) to cover
  `arena_champion`.

## Verification: code
