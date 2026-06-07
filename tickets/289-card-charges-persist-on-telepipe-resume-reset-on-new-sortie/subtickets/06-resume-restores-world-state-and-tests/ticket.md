# 06 — Resume restores world state (no enemy respawn) and tests

Update `restoreCardCheckpoint()` to rehydrate the suspended dungeon from the checkpoint world snapshot instead of calling `spawnEnemies()`. Fix server tests that currently codify respawn-on-resume so the telepipe suspend → hub → redeploy path preserves enemy ids, objective progress, and layout continuity (matching harness `assertRunPreserved`).

## Acceptance Criteria

- `restoreCardCheckpoint()` assigns `_gameState.enemies`, `minions`, `loot`, `areaEffects`, `iceBalls`, `enchantments`, and `telepipe` from the checkpoint world snapshot.
- Restores `_gameState.layout`, `layoutSeed`, and `dungeonBounds` from checkpoint when captured (so resume uses the same dungeon geometry as pre-suspend).
- **Does not** call `spawnEnemies()` on the telepipe-resume path.
- After resume deploy: every pre-suspend enemy `id` is present with the same `hp`; no new non-`spawnedBy` enemy ids appear.
- `run.objective` matches pre-suspend values (`type`, `totalEnemies`, `defeatedEnemies`).
- Card charge, HP, and magic-stone behavior from sub-tickets 01–04 is unchanged (regression guard).
- `repositionPlayersAwayFromPortal()` runs when a restored telepipe exists so players are not stuck inside portal radius.
- **`game/server/test/server.test.js`**: add/extend test that suspend → resume preserves injected enemy id and objective fields.
- **`game/server/test/integration.test.js`**: update `two-player telepipe extract returns to hub and redeploy spawns a fresh dungeon` — rename to reflect resume (not fresh dungeon) and assert injected enemy id **is present** after redeploy; fix any assertion that expects respawned enemies or absent telepipe when checkpoint captured one.
- `pnpm test:quick` passes.

## Technical Specs

- **`game/server/progression.js`**:
  - In `restoreCardCheckpoint()`: after restoring run + player card state, assign world arrays from checkpoint; call `repositionPlayersAwayFromPortal(all)` when `telepipe` restored; call `ensureEncounterSpawnAnchor` only when encounter exists (do not spawn fresh enemies).
  - Remove the `spawnEnemies()` call from the resume branch (line ~2680 today).
  - Rebuild wall colliders via existing `setRebuildWallColliders` hook if layout is reassigned.
- **`game/server/test/server.test.js`**: world-state preservation unit test(s) for full suspend → resume roundtrip.
- **`game/server/test/integration.test.js`**: flip enemy-presence expectation on telepipe-resume redeploy; keep abandon/new-sortie tests asserting **new** run id and reset cards untouched.

## Verification: code
