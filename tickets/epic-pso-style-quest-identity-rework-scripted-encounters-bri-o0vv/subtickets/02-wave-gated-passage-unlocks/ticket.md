# 02 — Wave-gated passage unlocks

Gate dungeon passages behind scripted wave clears so players cannot skip ahead into uncleared combat rooms. Locked passages add temporary wall colliders across doorway gaps; clearing the configured wave removes the lock and rebuilds movement colliders on server and client.

## Acceptance Criteria

- Quest `scriptedEncounters` schema gains optional `passageLocks[]` entries mapping `{ afterWave: { roomIndex, waveIndex }, passageIndex }` (or landmark-based equivalent).
- On run start, passages listed in the first uncleared lock set are marked `locked: true` on `run.passageLocks` (or `layout.runtimeLocks`) and movement is blocked at those gaps.
- `buildWallColliders` in `game/server/simulation.js` injects barrier AABBs across locked passage doorways (reuse `passageWidth` / doorway zone math from `game/server/dungeon.js`).
- When sub-ticket 01 emits a wave-cleared event for a lock's `afterWave`, the passage unlocks, barriers are removed, `rebuildWallColliders()` runs, and clients receive updated colliders via the existing `stateUpdate` / movement context path.
- Players cannot walk through a locked passage in server simulation tests (position clamped or collision rejected).
- Unlocking a passage does not respawn enemies from earlier waves.
- `cd game && pnpm test:quick` passes, including new tests in `game/server/test/passage_locks.test.js`.

## Technical Specs

- **Edit:** `game/server/scriptedEncounters.js` — on wave clear, call `unlockPassagesForWave(run, roomIndex, waveIndex)`; initialize lock state in `initScriptedEncounter`.
- **Edit:** `game/server/simulation.js` — `buildWallColliders(layout, passageLocks)` (or read locks from `_gameState.run`) adds temporary full-gap AABBs for locked passages; export helper to compute doorway barrier boxes from passage + room geometry.
- **Edit:** `game/server/progression.js` — after unlock, call `rebuildWallColliders()` and ensure `stateSnapshot` / movement context includes refreshed colliders.
- **Edit:** `game/client/renderer.js` — when layout/collider payload changes, rebuild client `wallColliders` (mirror server barrier set); optional simple door mesh or blocker primitive at locked gaps (functional collision is required; decor is optional).
- **Edit:** `game/server/quests.js` — extend `ScriptedEncounterConfig` typedef with `passageLocks`.
- **Add:** `game/server/test/passage_locks.test.js` — spawn player on far side of locked passage → blocked; clear wave → passage walkable.
- **Depends on:** sub-ticket `01-scripted-wave-encounter-engine` wave-clear events.

## Verification: code
