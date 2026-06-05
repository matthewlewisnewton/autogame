# Wire cosmetic.modelId into avatar glTF loading

Audit `models.js` and `createPlayerAvatar` — the registry already maps `player` to `/models/player.glb`, but the renderer hardcodes `'player'` and ignores `cosmetic.modelId`. Resolve the model from the cosmetic profile, include `modelId` in change detection, and keep the procedural fallback when the registry path is missing or load fails.

## Acceptance Criteria

- `createPlayerAvatar` loads the glTF model using `cosmetic.modelId` (falling back to `'player'` when absent/unknown), via `modelPathFor` / `MODEL_REGISTRY` in `game/client/models.js`.
- `cosmeticSignature` includes the resolved `modelId` so switching models triggers an avatar rebuild.
- A missing or failed model load still leaves the procedural primitive visible (existing fallback behavior unchanged).
- Existing client tests pass; add or extend a unit test asserting the registry key/path comes from `modelId`.

## Technical Specs

- `game/client/models.js` — no schema change expected; confirm `MODEL_REGISTRY.player` and `modelPathFor()` are the lookup surface (add a short comment if helpful).
- `game/client/renderer.js`:
  - Resolve `modelKey` from `cosmetic.modelId` (mirror server `MODEL_IDS`, default `'player'`).
  - Pass `modelKey` to `attachRegistryModel` instead of the literal `'player'`.
  - Append `modelId` to `cosmeticSignature`.
- `game/client/test/models-registry.test.js` — add a case that `createPlayerAvatar({ modelId: 'player', … })` requests `/models/player.glb`.

## Verification: code
