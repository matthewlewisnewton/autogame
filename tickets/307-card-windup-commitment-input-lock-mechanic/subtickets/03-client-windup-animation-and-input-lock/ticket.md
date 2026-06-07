# Client: wind-up animation and input-lock feedback

When the local player is card-committed (server snapshot fields from sub-ticket
01), block client-side movement and card input, and show a visible wind-up
telegraph on the player plus disabled feedback on the card hand. Resume normal
input when commitment clears (after `CARD_USED` / `STATE_UPDATE`).

## Acceptance Criteria

- `main.js` reads `gameState.players[myId].cardUseState` /
  `cardWindupUntil` from `STATE_UPDATE` and treats the local player as
  input-locked while committed.
- While committed, `useCard()` returns without emitting `useCard` to the server
  (extend `canUseSlot` in `hand.js` or a dedicated guard, same pattern as
  cooldown / creature burn-down).
- While committed, movement input is not sent (guard the `MOVE` emit path in
  `main.js` / `movementPrediction.js` so WASD does not emit during lockout).
- `renderer.js` shows a player wind-up telegraph while committed — e.g. ground
  ring and/or emissive flash on the local (and remote) player mesh, visually
  distinct from enemy wind-up telegraphs but reusing the same helper patterns
  (`telegraphMeshes`, emissive flash bookkeeping).
- `#card-hand` (or `.card-slot` elements) gain a visible locked/disabled state
  during commitment (CSS class such as `input-locked` defined in the client
  stylesheet).
- When commitment ends, telegraph/lockout visuals are removed and input resumes
  normally.
- New client tests in `client/test/main.test.js` (or a dedicated
  `card_windup.test.js`) verify: committed snapshot blocks `__useCardForTest`
  emit; movement emit guard; lockout class toggles.

## Technical Specs

- `game/client/main.js` — add `isLocalPlayerCardCommitted()` reading hot
  snapshot fields; gate `useCard()`, keyboard/card hotkeys, and the `MOVE` socket
  emit. Optionally start local wind-up VFX optimistically on own `useCard` for
  `windUpMs` cards, but server snapshot remains authoritative.
- `game/client/hand.js` — extend `canUseSlot()` (or add `isHandInputLocked()`)
  to return `false` while the local player is committed.
- `game/client/renderer.js` — in the player update loop, detect
  `cardUseState === "windup"` on each player mesh and show/hide a wind-up
  telegraph (reuse `createTelegraphRing` / emissive patterns from enemy wind-up
  ~lines 107–123, 3120–3140).
- `game/client/index.html` or client CSS — styles for `.input-locked` /
  `#card-hand.input-locked .card-slot` (reduced opacity, `pointer-events:
  none`).
- `game/client/test/main.test.js` — tests for input lock and hand CSS class
  toggling via mocked `gameState` / `__triggerSocketEvent('stateUpdate', ...)`.

## Verification: code
