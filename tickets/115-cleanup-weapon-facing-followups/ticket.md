# Cleanup weapon-facing + orbit camera followups

> **Staleness note.** This follow-up ticket was written against commit
> `b299845` (2026-05-23). The codebase may have moved on since it was filed —
> before acting, re-check every file path and code reference below
> against the CURRENT code, and skip any nit that is already resolved.

`4c43bbe` aligned weapon combat with player facing and introduced an orbit camera, fixed-tick prediction, and a shared `tryPlayerMove` between client and server. The change is largely sound but left a handful of correctness rough edges around input lifecycle, redundant persistence, lost analog magnitude, and missing unit coverage on the new server `applyPlayerMovement` path.

## Difficulty: medium

## Code references

> The references in this section were reviewed at commit `b299845`; verify them against the current code before editing.

- `game/server/index.js` move handler — calls `savePlayerData(socket.playerId)` on every move packet regardless of whether position actually changed. Most saves now persist stale state because `applyPlayerMovement` updates position later in the tick. Save only after `applyPlayerMovement` mutates the player, or batch saves per tick.
- `game/server/index.js:978` — stores `player.inputRotation = data.rotation` without `Number.isFinite` guard; `applyPlayerMovement` does check `Number.isFinite(player.inputRotation)` later, so the two layers are inconsistent. Add the guard on input.
- `game/server/index.js` comment "Position is saved from applyPlayerMovement after the tick step runs" — misleading, since `applyPlayerMovement` does not call `savePlayerData`. Fix the comment or the behavior.
- `game/client/renderer.js` keydown listener — guards with `isTypingTarget`, but the keyup listener does not. If a movement key is pressed before focusing chat, it can never be released while focus stays in the input, leaving the key stuck (the new `blur`/`visibilitychange` resets mitigate it but do not eliminate the case).
- `game/client/renderer.js` `syncFacingToServer` — while movement input is active, the function early-returns and sets `lastEmittedRotation = playerRotation`; the actual emit in `updateMyPlayer` uses `Math.atan2(dirZ, dirX)`. Values coincide today because `updatePlayerFacing` derives `playerRotation` the same way, but the coupling is implicit. Compute the value in one place and share it.
- `game/client/renderer.js` `getKeyboardMovement` / `pollGamepadMovement` / `mergeMovementVectors` — normalize the merged vector to unit length, so partial right-stick deflection produces full-speed movement. Preserve analog magnitude.
- `game/client/test/collision-hand.test.js:139-143` — test "slides along a wall when direct movement is blocked" places the player at `x=-0.5` moving `+Z` next to a wall whose `+X` face is at 0. Since `pMaxX == w.minX` is treated as non-overlap, direct movement succeeds and the slide branch is never exercised. Pick a fixture that forces the slide.
- `game/client/test/collision-hand.test.js:165` — typo: "depentrates" → "depenetrates".
- `game/client/renderer.js:103-108` — `simX/simZ/prevSimX/prevSimZ/moveAccumulator` are module-level with no comment about their relationship to `myX/myZ`. Add a short doc comment.
- Commit body silent on the new right-mouse-drag and gamepad right-stick orbit camera scheme — note in `docs/` or in the relevant README so players know about the new UX.
- No unit tests cover `applyPlayerMovement`, the rotation-only `move` path, `INPUT_STALE_MS`, or the `effect`-typed branch in `spawnAttackEffect`. Add focused coverage.

## Acceptance Criteria

- `savePlayerData` is called at most once per tick per player (or only when position actually changed); a focused test counts persistence writes over N move packets and asserts the new cap.
- `player.inputRotation` is validated as finite at ingress; invalid rotations are dropped (or the server-side `Number.isFinite` check is removed in favor of ingress validation only).
- Keyup listener clears movement keys regardless of focus target.
- Analog gamepad magnitude is preserved end-to-end (full-stick = full speed, half-stick ≈ half speed). Add a test that asserts a partial-magnitude input produces proportional displacement.
- "Slides along a wall" test exercises the slide path (assert the player slid, not that they moved straight).
- New unit coverage for `applyPlayerMovement`, the rotation-only move path, and `INPUT_STALE_MS` timeout behavior.
- Orbit camera UX documented in a player-facing or developer-facing doc.

## Technical Specs

- Likely files: `game/server/index.js`, `game/server/simulation.js`, `game/client/renderer.js`, `game/client/test/collision-hand.test.js`, `game/server/test/simulation.test.js` (or a new `applyPlayerMovement.test.js`).

## Verification: code
