# 03 — Permafrost Warden client render and lock-on

Give `permafrost_warden` a visually distinct client presentation and ensure lock-on / encounter HUD can resolve its display metadata from the server catalog.

## Acceptance Criteria

- `permafrost_warden` has entries in client `ENEMY_GEOMETRY` and `ENEMY_ATTACK_VISUAL` in `renderer.js` that are visually distinct from `miniboss`, `glacial_thrower`, and other stage bosses (ice-cyan palette, boss-scale silhouette).
- Attack telegraph shape matches server `ENEMY_DEFS.permafrost_warden` `attackStyle` / `attackRange` / cone fields so wind-up indicators mirror server-side hits.
- `MODEL_REGISTRY` in `models.js` includes `permafrost_warden` (`null` for procedural-only or a placeholder GLB path); `modelPathFor('permafrost_warden')` is defined.
- `enemyMeshHalfHeight` / geometry lookup helpers resolve `permafrost_warden` to its own geometry (not the `grunt` fallback).
- Lock-on info panel tests (or a focused wiring test) show `permafrost_warden` name and at least one surfaced stat from the display catalog when locking onto a spawned boss.
- Client registry tests (`models-registry.test.js`, `renderer-registry-normalize.test.js`) include `permafrost_warden` and pass.
- `pnpm test:quick` passes.

## Technical Specs

- **`game/client/renderer.js`** — Add `permafrost_warden` to `ENEMY_GEOMETRY` and `ENEMY_ATTACK_VISUAL` (ice-themed colors; boss-scale radius/height larger than `glacial_thrower`). Confirm half-height helpers pick up the new key.
- **`game/client/models.js`** — Register `permafrost_warden` in `MODEL_REGISTRY` (placeholder `null` or `/models/miniboss.glb` acceptable).
- **`game/client/test/renderer-registry-normalize.test.js`** — Assert footprint / host vertical offset for `permafrost_warden`.
- **`game/client/test/models-registry.test.js`** — Include `permafrost_warden` in procedural-only or model-path enumeration.
- **`game/client/test/lock-on-info-panel.test.js`** (or **`game/client/test/boss-encounter-hud-wiring.test.js`**) — Add a case locking onto / fighting a `permafrost_warden` with catalog metadata resolving to **Permafrost Warden**.
- Keep server/client attack shape in agreement with sub-ticket 02's `ENEMY_DEFS.permafrost_warden`.
- Depends on sub-ticket 02.

## Verification: code
