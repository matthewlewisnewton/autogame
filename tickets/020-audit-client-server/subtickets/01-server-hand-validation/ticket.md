# Server-Side Hand and Charge Validation for useCard

The server's `useCard` handler only checks that `cardId` exists in `CARD_DEFS`. It does not verify the card is actually in the server-owned hand slot, does not spend charges, does not exhaust/redraw cards, and does not maintain hand state. A modified client can emit `useCard` with any defined card ID repeatedly. Add server-side hand state and validate every `useCard` against it.

## Acceptance Criteria
- The server maintains a `hand` array (up to 4 cards) per player, initialized from the shuffled draw deck when the run starts.
- On `useCard`, the server validates that `hand[slotIndex]` exists and its `id` matches the requested `cardId`. Mismatched or empty slots are rejected.
- Weapon cards: the server decrements `remainingCharges` on the server-side hand card; when charges reach 0, the card is removed and a replacement is drawn from the server-side deck.
- Summon cards: behavior unchanged (Magic Stones cost is already validated server-side); the card is removed from hand and a replacement drawn after the summon resolves.
- Monster cards: the card is removed from hand and a replacement is drawn after the minion is spawned.
- After processing `useCard`, the server broadcasts the updated `hand` array to the requesting client via the existing `stateUpdate` mechanism (already included in `stateSnapshot`).
- Impossible `useCard` requests (empty slot, wrong card, exhausted deck) are silently rejected (no `cardUsed` broadcast).

## Technical Specs
- **File**: `game/server/index.js` — add `player.hand` initialization in `checkAllReady()` (after `createDrawDeckFromSelectedDeck`). Deal 4 cards from `player.deck` into `player.hand` using the same structure the client uses (`{ id, name, type, charges, remainingCharges, magicStoneCost? }`). Add hand validation at the top of the `useCard` handler: check `player.hand[slotIndex]` exists and `hand[slotIndex].id === data.cardId`. Add charge spending / exhaust / redraw logic in each card-type branch (weapon, summon, monster). Do not modify the existing hit-test, damage, or broadcast logic — only add hand validation before it.
- **No other files changed.** Do not modify client files, config, or tests.

## Verification: code
