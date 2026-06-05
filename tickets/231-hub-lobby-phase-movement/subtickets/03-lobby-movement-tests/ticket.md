# Tests for lobby-phase hub movement accept and bounds

Add automated coverage that lobby-phase `move` events are accepted with the same validation rules as in-run moves and that integrated displacement stays within hub geometry.

## Acceptance Criteria

- A new test suite proves that emitting `move` while `gamePhase === 'lobby'` updates player position after a tick (without entering a debug playing scenario).
- Tests assert invalid lobby moves are rejected: non-finite `dx`/`dz`/`rotation`, non-object payload, and stale `sequence`.
- Tests assert lobby movement cannot leave hub bounds: after sustained input toward an edge, `player.x`/`player.z` stay within hub `dungeonBounds` and inside hub `walkableAABBs`.
- Tests assert a lobby move into a hub wall does not place the player inside a collider (`isEntityPositionBlocked` or equivalent).
- `pnpm test:quick` (or the project's fast server test command) passes with the new tests included.

## Technical Specs

- **`game/server/test/lobby_hub_movement.test.js`** (new file)
  - Use existing test helpers (`startTestServer`, `connectClient`, `waitForEvent`, `sleep`, lobby `createLobby` flow) from `game/server/test/helpers.js` / `integration.test.js` patterns.
  - Import `HUB_LAYOUT`, `computeDungeonBounds`, `computeWalkableAABBs`, `isEntityPositionBlocked`, and `testGameState` (or equivalent lobby state accessor).
  - Case 1: create lobby → emit `move` with `{ dx: 1, dz: 0, rotation: 0, sequence: 1 }` → wait for tick → expect `player.x` increased.
  - Case 2: emit invalid payloads and expect position unchanged / no sequence advance.
  - Case 3: place player near hub edge, emit move toward outside, assert clamped inside `computeDungeonBounds(HUB_LAYOUT)`.
  - Case 4 (optional wall slide): probe a hub wall edge similar to `integration.test.js` wall-resolution test but in lobby phase without `debugScenario`.
- No production code changes unless a minimal export is required for testing (prefer reusing existing exports from `index.js` / `simulation.js`).

## Verification: code
