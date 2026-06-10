# 01 — Server passage-lock collision hardening

Extend the existing `run.passageLocks` runtime so locked passages block enemy movement and telepipe extraction still works while gates are down. Add regression tests for non-scripted quests (no locks) and confirm unlock updates colliders within the same simulation tick.

## Acceptance Criteria

- An enemy with a wander/chase target across a locked passage cannot move through the doorway barrier (`moveEntityToward` / `isEntityPositionBlocked` returns blocked while `locked: true`).
- Clearing the bound scripted wave sets `run.passageLocks[n].locked` to `false` and `rebuildWallColliders()` removes the barrier AABB in the same `removeDeadEnemies` / wave-advance pass (no extra tick required).
- Deploying a non-scripted quest (e.g. default `open_plaza` tier 1) leaves `run.passageLocks` empty/absent and `buildWallColliders(layout, [])` unchanged vs. a layout with no locks.
- A player behind an active passage lock can still place and enter a Telepipe portal to extract (run suspends normally; `passageLocks` state is preserved in the checkpoint).
- `cd game && pnpm test:quick` passes, including new/extended cases in `game/server/test/passage_locks.test.js` (enemy pathing + telepipe-with-lock).

## Technical Specs

- **Edit:** `game/server/test/passage_locks.test.js` — add enemy pathing case: spawn enemy in start room, aim wander target into locked passage, assert `moveEntityToward` blocked; after wave clear, movement succeeds. Add telepipe extract case using existing telepipe helpers from `game/server/test/server.test.js` with `deployPassageLockFixture()`.
- **Edit:** `game/server/scriptedEncounters.js` — if unlock does not already trigger collider rebuild before tick ends, ensure `unlockPassagesForWave` callback chain is intact (wired in `game/server/index.js` via `setPassageLocksChangedCallback`).
- **Edit:** `game/server/simulation.js` — confirm `buildWallColliders` / `getWallColliders` include `collectLockedPassageBarrierAABBs` for enemies (`isEntityPositionBlocked` already calls `getWallColliders()`); no duplicate collider logic.
- **Edit:** `game/server/progression.js` — confirm `captureRunCheckpoint` persists `run.passageLocks`; telepipe suspend/resume path already clones checkpoint — verify in test.
- **Reference (no schema change):** `passageLocks[]` on `quest.scriptedEncounters` with `{ afterWave: { roomIndex, waveIndex }, passageIndex | fromRoomIndex }`; runtime state on `run.passageLocks`.

## Verification: code
