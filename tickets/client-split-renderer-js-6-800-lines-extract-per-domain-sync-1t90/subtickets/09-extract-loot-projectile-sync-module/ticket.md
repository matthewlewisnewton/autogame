# Move loot + ice-ball + telepipe sync into game/client/renderer/lootSync.js

Move the loot pickup/animation domain and the ice-ball + telepipe projectile/
portal sync out of `renderer.js` into a real module imported by `renderer.js`.
Behavior unchanged. Depends on sub-ticket 06.

## Acceptance Criteria

- A new file `game/client/renderer/lootSync.js` exists and exports
  `syncLootMeshes()`, `animateLootMeshes()`, `markLootCollected()`,
  `updateCollectingLoot()`, `syncIceBallMeshes()`, and `syncTelepipeMesh()` (plus
  `animateTelepipePortal()` if it currently lives beside the telepipe sync),
  with bodies unchanged in behavior.
- Loot/ice-ball/telepipe-only helpers and state used solely here move into the
  module (e.g. `createLootMesh`, `getLootBaseY`, `disposeLootMeshMaterials`,
  `createIceBallMesh`, the `ICE_BALL_HEIGHT` constant, `previousLootValues`,
  `collectingLoot`, loot-float color constants, telepipe build helpers).
- Cross-cutting helpers (`spawnDamageNumber`, `playSound`, `disposeOne`) and the
  mesh-map stores (`lootMeshes`, `iceBallMeshes`) are imported, not duplicated;
  scene/maps come from `./rendererState.js`, generic reconcile/dispose from
  `./meshSync.js`.
- `syncIceBallMeshes` continues to reconcile via the shared `syncMeshMap` helper,
  and loot stale-removal still routes through `markLootCollected` (collection
  animation preserved).
- `renderer.js` no longer defines these functions locally — it imports them from
  `./renderer/lootSync.js`; `animate()` still calls `syncLootMeshes`,
  `syncIceBallMeshes`, `syncTelepipeMesh`, `animateLootMeshes`,
  `animateTelepipePortal`, and `updateCollectingLoot` at the same points as before.
- `pnpm test` (from `game/`) passes; game boots with loot coins bobbing, pickup
  collection animation + floating value, ice-ball projectiles, and the telepipe
  portal rendering as before (no console `pageerror`).

## Technical Specs

- New: `game/client/renderer/lootSync.js`.
- Edit: `game/client/renderer.js` — cut the loot sync block (`syncLootMeshes`
  ~6135–6164, `markLootCollected` ~5923–5954, `updateCollectingLoot` ~5959–5989,
  `animateLootMeshes` ~6216+), the ice-ball block (`createIceBallMesh` ~6180–6191,
  `syncIceBallMeshes` ~6199–6211), and the telepipe block (`syncTelepipeMesh`
  ~5996+ and its animate counterpart) plus their private helpers; add
  `import { ... } from './renderer/lootSync.js'`. Export back any cross-cutting
  helper the module imports (call-time-only, cycle-safe).
- Keep the loot-proximity pickup emission (`findClosestLootInRange` /
  `tryEmitLootPickup`) wherever it currently sits unless it moves cleanly with
  the loot cluster — do not change its behavior.
- Do NOT touch any sub-ticket folder containing a `.passed` marker.

## Verification: code
