# Objective navigation helpers for quest-critical loot

Add a pure client module that resolves the nearest uncollected quest-critical loot (resonance prisms) from synced `gameState.loot` and computes the world bearing / screen-relative arrow rotation needed for spatial objective guidance. No DOM or render wiring in this sub-ticket — only exported helpers and unit tests.

## Acceptance Criteria

- `game/client/objectiveNav.js` exports helpers to (a) detect quest-critical objective loot (`kind === 'crystal'` and `questCritical === true`), (b) pick the nearest such loot entry to a player `(x, z)`, and (c) compute the horizontal bearing from player to target plus the arrow rotation relative to a supplied camera yaw.
- When multiple crystals remain, the helper returns the closest by Euclidean distance on the XZ plane; when none remain it returns `null`.
- Bearing math uses the project's XZ coordinate convention (same `atan2` sign as `lockOn.js` / movement) and normalizes angles via shortest-arc delta so the arrow does not flip at the ±π boundary.
- `game/client/test/objectiveNav.test.js` covers: empty loot, non-crystal loot ignored, nearest-of-three selection, bearing at 0°/90°/behind-player, and camera-relative rotation cases.
- `pnpm test:quick` passes with no changes to gameplay UI yet.

## Technical Specs

- **Add** `game/client/objectiveNav.js` exporting at minimum:
  - `isQuestCriticalLoot(item)` — true when `item?.kind === 'crystal'` and `item?.questCritical === true`.
  - `findNearestQuestCriticalLoot(loot, playerX, playerZ)` — filters with `isQuestCriticalLoot`, returns `{ x, z, distance }` for the nearest entry or `null`.
  - `computeWorldBearing(playerX, playerZ, targetX, targetZ)` — horizontal bearing in radians.
  - `computeArrowRotation(worldBearing, cameraYaw)` — rotation for a compass arrow element (world bearing minus camera yaw, shortest arc). Reuse or mirror `shortestAngleDelta` / `normalizeAngle` from `game/client/lockOn.js` rather than duplicating unstable angle logic.
- **Add** `game/client/test/objectiveNav.test.js` with the cases listed above.
- **No changes** to `index.html`, `style.css`, `main.js`, or `renderer.js` in this sub-ticket.

## Verification: code
