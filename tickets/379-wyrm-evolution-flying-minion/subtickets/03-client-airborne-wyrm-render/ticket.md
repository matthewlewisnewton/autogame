# Client — airborne Archive Wyrm render and breath VFX

Render summoned Archive Wyrm minions at altitude with a ground shadow (reuse ticket 376 minion airborne path) and place fire-breath VFX at the minion's airborne height when the server sends `origin.y`.

## Acceptance Criteria

- A flying `ancient_wyrm` minion mesh is positioned via `flyingRenderOffset` + ground shadow in `minionSync` (same path as `storm_eagle` / `thunderbird`); grounded `dungeon_drake` minions are unchanged.
- `renderWyrmAttack` for `ancient_wyrm` fire breath uses `origin.y` (when present) for `spawnAttackEffect`, telegraph ring, and along-cone particle burst Y — not a fixed `0.8` / ground plane.
- `originOf()` returns `y` when the server payload includes it; grounded wyrm payloads without `y` keep prior ground-level VFX.
- `cardRenderers.test.js` covers Archive Wyrm breath with `origin: { x, z, y }` and asserts effect spawn Y reflects the airborne origin.
- Client tests remain green; no new visual-only regressions for Vault Wyrm (`dungeon_drake`) breath rendering.

## Technical Specs

- **`game/client/renderer/minionSync.js`**: update the flying-minion comment to list `ancient_wyrm`; no behavioral fork unless the generic `flying` branch is missing for wyrm type (fix if so).
- **`game/client/cardRenderers.js`**:
  - `originOf`: preserve optional `y` on `data.origin`.
  - `renderWyrmAttack`: for `ancient_wyrm` + `fire_breath`, pass airborne `origin.y` into `spawnAttackEffect` / `spawnTelegraphRing` / `spawnParticleBurst` (derive along-cone point Y from origin + tilted direction when `direction.y` is set).
- **`game/client/renderer.js`**: if `spawnAttackEffect` cone placement ignores `origin.y`, lift the default cone group to `origin.y ?? GROUND_OVERLAY_Y` when provided (minimal change; prefer using existing style hooks over a wyrm-only hack).
- **`game/client/test/cardRenderers.test.js`**: airborne Archive Wyrm breath case with `origin: { x: 0, z: 0, y: 4 }` and tilted `direction`.
- **`game/client/test/airborne-floor-render.test.js`** (optional): one case asserting `flyingRenderOffset` for a minion shaped like `{ flying: true, altitude: 4, type: 'ancient_wyrm' }`.

## Verification: code
