# Cache cosmetic signatures and reuse local status-indicator scratch objects

Every frame `syncPlayerMeshes` calls `cosmeticSignature(pData.cosmetic)` for each player (allocating a template string even when cosmetics are unchanged) and allocates fresh `{ slowedUntil, x, z }` / `{ burningUntil, x, z }` literals for the local player's slow/burn indicators. Cache the signature on avatar `userData` keyed by cosmetic snapshot identity, and reuse module-level scratch objects for the local-player indicator calls.

## Acceptance Criteria

- Avatar rebuild detection no longer calls `cosmeticSignature()` every frame when `pData.cosmetic` is the same object reference as the last frame; signature is recomputed only when the cosmetic snapshot reference changes (or avatar is first created)
- `userData.cosmeticKey` still matches what `cosmeticSignature()` would return after a real cosmetic change (avatar rebuilds correctly)
- Local-player `applySlowIndicator` / `applyBurnIndicator` calls no longer allocate per-frame object literals; module-scoped scratch objects are mutated in place each frame
- Remote players continue passing `pData` directly to slow/burn indicators (no behavior change)
- `pnpm test:quick` passes; `avatar-cosmetic-render.test.js` and slow/burn coverage in `main.test.js` remain green

## Technical Specs

- **File:** `game/client/renderer/playerSync.js`
  - Cosmetic cache: on each player, compare `playersMeshes[id]?.userData.cosmeticRef === pData.cosmetic`; when equal, reuse existing `userData.cosmeticKey`; when unequal (or no mesh), call `cosmeticSignature(pData.cosmetic)`, store result on `userData.cosmeticKey`, and set `userData.cosmeticRef = pData.cosmetic`
  - Add module-level scratch objects, e.g. `_localSlowScratch = { slowedUntil: 0, x: 0, z: 0 }` and `_localBurnScratch = { burningUntil: 0, x: 0, z: 0 }`
  - For `id === myId` slow/burn branches: assign fields on the scratch object, then pass the scratch object to `applySlowIndicator` / `applyBurnIndicator` instead of inline literals
- **File:** `game/client/renderer.js` — no change required unless tests need a small export tweak; `cosmeticSignature()` itself stays as-is

## Verification: code
