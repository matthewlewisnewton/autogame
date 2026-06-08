# Server: input lock until pending card resolves

Close the timing gap: `isPlayerCardCommitted()` currently returns false as soon as
wall-clock `windUpMs` elapses, but `pendingCardUse` may remain until
`processPendingCardWindups()` runs later in the tick (after `applyPlayerMovement` in
`index.js`). During that window movement and `useCard` can be accepted before the
committed effect lands. Keep the player locked from commit until resolution clears
`pendingCardUse`.

## Acceptance Criteria

- `isPlayerCardCommitted(player)` returns `true` while `player.pendingCardUse` is
  set, even if `Date.now() - cardWindupStartTime >= cardWindupMs` (timer elapsed
  but effect not yet resolved).
- `handleUseCard` and the `MOVE` handler in `runHandlers.js` continue to reject
  input whenever `isPlayerCardCommitted` is true (no new code paths needed if the
  helper is fixed).
- `applyPlayerMovement` skips players who are still pending resolution (inherits
  the updated `isPlayerCardCommitted` check).
- Due wind-ups are resolved before movement in the playing-phase tick: call
  `processPendingCardWindups()` at the start of the playing branch in
  `runGameLoopTick` (before `applyPlayerMovement`), or equivalent ordering that
  guarantees resolution in the same tick the timer becomes due.
- `buildPlayerHotSnapshot` keeps exposing commitment while `pendingCardUse` exists
  (`cardUseState`, `cardWindupCardId`) so clients stay locked until the server
  clears state.
- New regression test in `card_windup_lock.test.js`: after advancing time past
  `windUpMs` but before calling `processPendingCardWindups`, assert movement
  (`applyPlayerMovement`) does not change position and a second `useCard` is
  rejected; after `processPendingCardWindups`, movement and card use work again.
- Existing wind-up tests still pass.

## Technical Specs

- `game/server/simulation.js` — update `isPlayerCardCommitted` (~line 2249) to
  return true when `player.pendingCardUse` is defined, then fall back to the
  active timer check. Keep `clearPlayerCardCommitment` clearing all fields together.
- `game/server/index.js` — in `runGameLoopTick` playing branch (~line 1364),
  invoke `processPendingCardWindups()` before `applyPlayerMovement` (import from
  `simulation.js` if not already available in scope).
- `game/server/simulation.js` — retain the `processPendingCardWindups()` call inside
  `updateMinions` only if idempotent when nothing is due; otherwise remove the
  duplicate call to avoid double resolution (ensure exactly one resolution path per
  tick).
- `game/server/progression.js` — if `cardWindupUntil` is derived only from the
  timer, consider exposing commitment while `pendingCardUse` exists (e.g. extend
  `cardWindupUntil` or rely on `cardUseState === "windup"` until cleared).
- `game/server/socketHandlers/runHandlers.js` — no change expected beyond inheriting
  the fixed helper.
- `game/server/test/card_windup_lock.test.js` (new) — elapsed-but-unresolved lock
  regression using `magma_greatsword` or another wind-up exemplar.

## Verification: code
