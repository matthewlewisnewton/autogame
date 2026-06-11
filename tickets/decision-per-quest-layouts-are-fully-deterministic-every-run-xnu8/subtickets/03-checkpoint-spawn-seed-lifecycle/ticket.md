# Checkpoint lifecycle for per-run spawn seed

Verify and harden the telepipe suspend/resume and abort-sortie flows so per-run crystal placement behaves correctly across run lifecycles: resume keeps the suspended run's crystals; abort + fresh deploy rolls new positions on the same quest layout.

## Acceptance Criteria

- **Telepipe resume:** After last-player extract → suspend → ready → Deploy, restored `loot` crystal positions match the pre-suspend checkpoint (same `(x, z)` tuples and count); `runSpawnSeed` restored from checkpoint matches pre-suspend value; `spawnEnemies` is **not** re-invoked on resume (loot comes from checkpoint).
- **Abort sortie:** `abandonSuspendedRun()` then fresh ready + Deploy generates a **new** `runSpawnSeed` and **new** crystal positions while `layoutSeed` / room geometry for the quest+tier stays unchanged.
- **New sortie without prior checkpoint:** Each fresh deploy from a normal waiting lobby gets a new `runSpawnSeed` (regression guard against accidental quest-only seeding).
- Tests added or extended in `game/server/test/server.test.js` and/or `game/server/test/integration.test.js` following existing telepipe suspend/resume and `abandonRun` patterns; `pnpm test:quick` passes.

## Technical Specs

- **`game/server/progression.js`**
  - Confirm `captureWorldState()` includes `runSpawnSeed` (introduced in sub-ticket 02) and `restoreCardCheckpoint` restores it before re-entering the dungeon.
  - Confirm `restoreCardCheckpoint` early-return resume path does **not** call `spawnEnemies()` (crystals come from saved `world.loot`).
  - Confirm `abandonSuspendedRun` clears `suspendedCheckpoint` so the next deploy path in `checkAllReadyInner` mints a fresh `runSpawnSeed`.
  - If resume path is missing `runSpawnSeed` restore, fix in this ticket only (minimal diff).
- **`game/server/test/server.test.js`**
  - Extend existing suspended-checkpoint tests: assert crystal `(x,z)` preserved across suspend → resume for a `crystal_rescue` (or `collect_items`) deploy fixture.
  - Extend `abandonSuspendedRun` test: after abort + redeploy, `runSpawnSeed` and crystal positions differ from pre-abort deploy while `layoutSeed` is unchanged.
- **`game/server/test/integration.test.js`** (optional if server.test coverage is sufficient)
  - Socket-level `abandonRun` + redeploy smoke asserting crystal position change in `gameState.loot`.

## Verification: code
