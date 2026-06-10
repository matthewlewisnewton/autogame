# 08 — Unlocked passage authoritative player movement

`server/test/passage_locks.test.js > rejects server movement through a locked passage` proves static wall collision while locked, but after the bound wave clears `applyPlayerMovement` does not advance the player toward the target room (distance increases instead of decreases). Fix the server movement/collider path so unlocked passages are traversable by authoritative player movement.

## Acceptance Criteria

- With a locked passage, 40 ticks of `applyPlayerMovement` leave the player far from the target room (`distBeforeClear > 4`).
- After clearing wave 0, `run.passageLocks[n].locked` is `false`, `rebuildWallColliders()` removes the barrier, and 80 ticks of `applyPlayerMovement` move the player closer to the same target room (`distAfterClear < distBeforeClear`).
- Static checks remain green: `checkWallCollision` toward the passage is `true` while locked and `false` after unlock.
- Enemy `moveEntityToward` blocking/unblocking behavior in `passage_locks.test.js` stays passing.
- `cd game && pnpm test:quick` passes, including the full `passage_locks.test.js` suite.

## Technical Specs

- **Edit:** `game/server/simulation.js` — ensure `buildMovementContext` / `resolveMovementContext` / `applyPlayerMovement` derive wall colliders from the **current** `run.passageLocks` each tick (do not reuse a stale collider snapshot after `unlockPassagesForWave` + `rebuildWallColliders`). Confirm `setPassageLocksChangedCallback(() => rebuildWallColliders())` in `game/server/index.js` is invoked on unlock.
- **Edit:** `game/server/scriptedEncounters.js` — verify `unlockPassagesForWave` fires the collider-rebuild callback before the tick ends.
- **Reference:** `game/server/test/passage_locks.test.js` — keep the existing locked-then-unlocked `applyPlayerMovement` test; adjust fixture movement vectors only if the layout/passage direction is wrong (prefer fixing simulation over weakening the assertion).
- **Do not regress:** passage barrier AABB math in `collectLockedPassageBarrierAABBs` / `computePassageBarrierAABBs`.

## Verification: code
