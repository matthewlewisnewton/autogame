# Fix Debug Scenario Crash for Multi-Client

The `summon-ready` debug scenario crashes the server when a second client applies it after the first client has already entered `playing`. `enterPlayingPhase()` skips hand initialization when `gamePhase === 'playing'`, so the second player has no `player.hand`. The subsequent `player.hand.some(...)` call throws `TypeError: Cannot read properties of undefined (reading 'some')`.

Fix: make `applyDebugScenario()` initialize the requesting player's draw deck, hand, cooldowns, and pending-summon state even when `gameState.gamePhase` is already `playing`, before accessing `player.hand`.

## Acceptance Criteria
- Calling `applyDebugScenario('summon-ready')` from two connected clients in succession does not crash the server.
- The second player receives a properly initialized hand (4 cards) and draw deck after applying the scenario.
- The second player's hand contains at least one summon card (same guarantee as the first player).
- The second player has initialized slot cooldowns (`player.slotCooldowns`) and an empty `pendingSummons` set.
- Existing behavior for the first client (single-client scenario) is unchanged.

## Technical Specs
- **File**: `game/server/index.js` — In `applyDebugScenario()`, after `enterPlayingPhase()` returns, add a per-player initialization block that runs when `gameState.gamePhase === 'playing'` (i.e., when `enterPlayingPhase()` skipped initialization for this player):
  1. Check if `player.hand` is missing or empty. If so:
     - Call `createDrawDeckFromSelectedDeck(player)` to build the draw deck
     - Call `initPlayerHand(player)` to deal 4 cards
     - Initialize `player.slotCooldowns` as an array of 4 zeros (or `null`s)
     - Initialize `player.pendingSummons` as a new `Set()` (if not already done earlier in the function)
  2. Place this check **before** the `if (name === 'summon-ready')` block that accesses `player.hand.some(...)`, so all scenario branches benefit.
- **No other files changed.** Do not modify client code, test files, or other debug scenarios.

## Verification: code
