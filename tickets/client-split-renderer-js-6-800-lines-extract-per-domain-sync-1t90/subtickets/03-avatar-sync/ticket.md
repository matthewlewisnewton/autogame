# Extract `avatarSync` module (cosmetic-driven avatar rebuild)

Extract the per-player avatar build/rebuild path from `animate()` into an `avatarSync` module. This covers cosmetic signature diffing, avatar disposal/recreation, proportion morphs, and equipped key-item prop updates — not positioning, nameplates, or combat VFX (those land in `playerSync`).

## Acceptance Criteria

- New module `game/client/renderer/avatarSync.js` exports a function (e.g. `syncPlayerAvatar(id, pData, { isLocal })`) that: computes `cosmeticSignature`, rebuilds the avatar when the signature changes (`disposeAvatar` + `createPlayerAvatar` + `scene.add`), calls `applyLoadedModelCosmetic`, and calls `updateKeyItemProp` for `equippedKeyItemId`.
- `cosmeticSignature`, `createPlayerAvatar`, `disposeAvatar`, `applyLoadedModelCosmetic`, and `updateKeyItemProp` move to `avatarSync.js` (or stay in `renderer.js` only as re-exports if tests import them directly).
- The player loop inside `animate()` no longer contains inline avatar rebuild / cosmetic / key-item logic; it calls `avatarSync.syncPlayerAvatar` for each `gs.players` entry before other per-player updates.
- Hub and dungeon cosmetic swaps still take effect without reload (`avatar-cosmetic-render.test.js`, `avatar-cosmetic.test.js`, `hub-presence-avatars.test.js`, `keyItemProp.test.js` pass).
- Remote and local players both receive avatar rebuilds when broadcast cosmetic changes.

## Technical Specs

- **Add** `game/client/renderer/avatarSync.js`.
- **Change** `game/client/renderer.js` — remove moved avatar helpers from `animate()` player loop (~6202–6223); wire `avatarSync`; re-export `createPlayerAvatar` and related symbols used by tests (`models-registry.test.js`, `keyItemProp.test.js`).
- **Leave in `renderer.js` for now:** player position, rotation, death tint, nameplates, slow/burn/windup indicators, shield VFX, HP flash (handled in sub-ticket 04).
- Avatar module reads `playersMeshes` map and `scene` via injected context; does not own the map allocation.

## Verification: code
