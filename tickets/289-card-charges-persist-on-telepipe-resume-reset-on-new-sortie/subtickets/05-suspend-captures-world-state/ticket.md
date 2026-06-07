# 05 — Suspend captures live world state in checkpoint

Extend `captureCardCheckpoint()` so telepipe suspend saves the full in-progress dungeon world (enemies, loot, objective progress, and related transient arrays) before `resetTransientRunState()` clears live state. Card snapshots and run metadata from sub-ticket 01 stay intact; this adds the world slice the harness `assertRunPreserved` step expects.

## Acceptance Criteria

- `captureCardCheckpoint()` deep-copies (JSON clone or equivalent) into the checkpoint:
  - `_gameState.enemies` (all fields needed to resume combat, including `id`, `hp`, `maxHp`, `type`, `spawnedBy`, positions, and AI state)
  - `_gameState.minions`, `_gameState.loot`, `_gameState.areaEffects`, `_gameState.iceBalls`, `_gameState.enchantments`
  - `_gameState.telepipe` (portal position/placement metadata when present)
  - `_gameState.layout`, `_gameState.layoutSeed`, `_gameState.dungeonBounds` when set
- `run.objective` and `run.encounter` in the checkpoint reflect live pre-suspend values (including `defeatedEnemies`, `totalEnemies`, encounter progress).
- After `suspendRunToLobby()`, `suspendedCheckpoint` holds the captured world arrays while live `_gameState.enemies` (and other transient fields) are cleared as today.
- Mutating a live enemy after suspend does not mutate the checkpoint copy (deep copy, not shared references).
- Unit test: deploy → inject or spawn enemies with known ids → partial damage/objective progress → full telepipe extract → assert checkpoint enemy ids and objective match pre-suspend live state.

## Technical Specs

- **`game/server/progression.js`**:
  - Extend `captureCardCheckpoint()` with a `worldState` (or top-level) block containing cloned arrays/objects listed above.
  - Capture **before** `resetTransientRunState()` in `suspendRunToLobby()` (already calls capture first — only widen the payload).
  - Optionally rename internally to `captureRunCheckpoint()` while keeping exports stable if tests import the old name.
- **`game/server/test/server.test.js`**: add test under the existing telepipe suspend/resume describe block asserting checkpoint world snapshots after `suspendRunToLobby()`.

## Verification: code
