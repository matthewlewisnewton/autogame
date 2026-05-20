# Client Hand Reconciliation with Server Authority

The server maintains an authoritative `player.hand` array (initialized in `checkAllReady` via `initPlayerHand`), included in every `stateSnapshot`. However, the client initializes its hand from `player.deck` (the remaining draw deck after cards are already popped), or falls back to a local starting deck. This causes the client-visible cards to diverge from the server hand — normal card clicks can be silently rejected by server validation. Sync the client hand to the server-authoritative hand on init and on every state update.

## Acceptance Criteria
- On `init`, the client initializes its hand from `state.players[myId].hand` (not from `player.deck` or a fallback starting deck).
- On every `stateUpdate`, the client reconciles its local `hand` array with `state.players[myId].hand` — replacing any slot whose card id differs from the server.
- The client no longer uses `player.deck` to initialize the hand; `player.deck` is the server's remaining draw deck, not the hand.
- Local optimistic card mutations (charge decrement, exhaust/redraw for weapon and monster cards) still occur on the client, but are immediately reconciled on the next `stateUpdate`.
- When the server hand has fewer than 4 cards (exhausted deck), the client renders empty slots for missing indices.

## Technical Specs
- **File**: `game/client/main.js` — In `initHand()`, replace the current logic (`initHandFromDeck(serverDeck, renderHand)`) with: read `gameState.players[myId].hand` from the init state, copy it into the module-level `hand` array from `hand.js`, and call `renderHand()`. If `gameState.players[myId].hand` is undefined or empty (edge case: init before run starts), fall back to `initHandFromModule(renderHand)`. In the `stateUpdate` handler, after `gameState = state`, add reconciliation: if `state.gamePhase === 'playing'` and `state.players[myId].hand` exists, compare each slot `i` (0–3) with the local `hand[i]`; if `hand[i]?.id !== serverHand[i]?.id`, set `hand[i] = serverHand[i]` (or `null` if undefined) and call `renderHand()`.
- **File**: `game/client/hand.js` — No changes needed; the `hand` array is already exported as mutable state. The `initHandFromDeck` function remains for the fallback path.
- **No other files changed.** Do not modify server files, config, or tests.

## Verification: code
