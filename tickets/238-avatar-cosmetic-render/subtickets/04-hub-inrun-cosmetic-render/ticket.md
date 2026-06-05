# Hub and in-run avatar cosmetic integration tests

The renderer already builds avatars from `gameState.players[id].cosmetic` in the animate loop for both lobby (hub) and playing phases. Add integration tests that drive the same contract `main.js` uses — custom cosmetic in state, `animate()` in hub and quest layouts — and assert the avatar reflects account config (colors, hat, proportions) and updates when cosmetic changes.

## Acceptance Criteria

- A test with `gamePhase: 'lobby'` and a hub layout builds a local avatar whose `userData.cosmeticKey` matches a non-default cosmetic (distinct body color + hat).
- A test with `gamePhase: 'playing'` and a quest layout builds the same avatar with the same cosmetic fields applied after mocked glTF load.
- A test simulates a cosmetic change between two `animate()` calls (e.g. hat `none` → `wizard`, or `bodyColor` change) and asserts the avatar rebuilds or re-tints accordingly (`cosmeticKey` / `hatId` / `baseColor` updated).
- Tests mock `GLTFLoader` (as in `models-registry.test.js`) so CI does not depend on fetching `/models/player.glb` over HTTP.
- `pnpm test:quick` from `game/` passes with the new tests.

## Technical Specs

- `game/client/test/hub-lobby-render.test.js` — extend with cosmetic-bearing `players` entries, OR add `game/client/test/avatar-cosmetic-render.test.js` dedicated to hub + in-run cosmetic rendering.
- `game/client/renderer.js` — read-only unless tests expose a gap (e.g. missing cosmetic default when `pData.cosmetic` is absent); use `DEFAULT_COSMETIC`-equivalent defaults already in renderer.
- Reuse `generateHub`, `generateLayout`, `initScene`, `setGameStateRef`, `setMyId`, `setGamePhase`, `animate`, `getMeshMaps` from existing hub render tests.

## Verification: code
