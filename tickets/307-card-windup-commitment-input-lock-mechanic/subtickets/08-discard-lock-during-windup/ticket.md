# Server and client: block discard during card wind-up

Close the remaining commitment gap: `discardCard` is still accepted while a
`windUpMs` card is pending, so a committed player can mutate hand state outside
the server-authoritative input lock. For wind-up creature cards, discarding the
pending source slot before `resolvePendingCardUse()` can break deferred minion
spawn. Reject `DISCARD_CARD` when `isPlayerCardCommitted(player)` is true, gate
the client `discardCard()` path the same way movement and card use are locked,
and add regression coverage for hand preservation and creature resolution.

## Acceptance Criteria

- `DISCARD_CARD` handler in `runHandlers.js` returns early when
  `isPlayerCardCommitted(player)` is true, emitting
  `CARD_ERROR { reason: 'Card commitment in progress' }` (same string as
  `handleUseCard`) **before** calling `discardCardFromHand`.
- Committed `discardCard` does not empty the targeted hand slot, schedule passive
  draw, or change `pendingCardUse`.
- After `processPendingCardWindups()` clears commitment, discard works normally
  again on a valid slot (no permanent lock).
- Client `discardCard()` in `main.js` returns early when
  `isLocalPlayerCardCommitted()` is true and does not emit `DISCARD_CARD`
  (mirror the existing `useCard` / key-item guards).
- New server regression test in `card_windup_lock.test.js`: start a
  `dungeon_drake` wind-up (creature with `windUpMs`), emit `discardCard` on the
  pending source slot while committed, assert `cardError` with commitment reason,
  hand slot still holds `dungeon_drake`, and `pendingCardUse` unchanged; call
  `processPendingCardWindups()` and assert the minion spawns and
  `activeMinionId` is set as in the existing creature wind-up lifecycle test.
- Optional but preferred: client test in `main.test.js` calling
  `__discardCardForTest` while `cardUseState: 'windup'` does not emit
  `discardCard`; after commitment clears, emit is allowed again.
- Existing wind-up, discard, and regression tests still pass.

## Technical Specs

- `game/server/socketHandlers/runHandlers.js` — in the `DISCARD_CARD` handler
  (~line 160), after the dead-player guard and before `discardCardFromHand`, add:
  `if (isPlayerCardCommitted(player)) { socket.emit(SERVER_TO_CLIENT.CARD_ERROR, { reason: 'Card commitment in progress' }); return; }`
  (`isPlayerCardCommitted` is already imported from `simulation.js`).
- `game/client/main.js` — at the top of `discardCard()` (~line 3789), return
  when `isLocalPlayerCardCommitted()` is true before validating hand contents or
  emitting `CLIENT_TO_SERVER.DISCARD_CARD`.
- `game/server/test/card_windup_lock.test.js` — add a `discardCard` rejection
  case: connect, start run, place `dungeon_drake` in a known slot (reuse
  `setupWindupCard` pattern from `card_windup_types.test.js` or inline hand
  setup), emit `useCard` to begin wind-up, advance timer past `windUpMs` while
  still committed via `pendingCardUse`, emit `discardCard` on that slot, assert
  rejection and unchanged hand/pending state, then `processPendingCardWindups()`
  and assert minion spawn + `activeMinionId` on the source card.
- `game/client/test/main.test.js` (optional) — with mocked
  `cardUseState: 'windup'`, call `window.__discardCardForTest(slotIndex)` and
  assert no `discardCard` socket emit; clear wind-up fields and assert emit
  resumes.

## Verification: code
