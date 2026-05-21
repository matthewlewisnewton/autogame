# Initialize Combat Hand on Active-Run Reconnect

When a player cold-reconnects during an active dungeon run, the server restores their location from persisted data but leaves `player.hand` and `player.deck` undefined. This causes `useCard` to be silently rejected, breaking the core combat loop even though the client HUD shows cards.

Fix: after merging saved data on reconnect, detect that the game is in an active run and initialize a server-authoritative draw deck + hand from the player's restored `selectedDeck`.

## Acceptance Criteria
- When a player reconnects while `gameState.gamePhase === 'playing'`, the server must initialize `player.hand` (array of card objects) and `player.deck` (draw deck array) from the player's `selectedDeck`.
- The reconnected player's `hand` must contain up to 4 card objects drawn from a shuffled copy of `selectedDeck`.
- After reconnecting mid-run, `useCard` emits must succeed for the reconnected player (server no longer silently rejects due to missing hand).
- Reconnect during lobby phase must remain unchanged — no deck/hand initialization on lobby connect.
- Existing behavior for fresh players (first connect, no saved data) must be unaffected.

## Technical Specs
- **File**: `game/server/index.js`
- In the `io.on('connection')` handler, after the "Merge saved data into player state" block, add a check:
  - If `gameState.gamePhase === 'playing'` AND the player does not already have a `hand` array (or it is empty), call `createDrawDeckFromSelectedDeck(player)` then `initPlayerHand(player)`.
  - Also restore `player.slotCooldowns = [null, null, null, null]` so the reconnected player isn't stuck with stale cooldowns.
  - Also restore `player.magicStones = MAX_MAGIC_STONES` and `player.hp` / `player.dead` to sensible defaults if not persisted (combat state that can't be restored from save).
- The existing helper functions `createDrawDeckFromSelectedDeck()` and `initPlayerHand()` already exist in the file — reuse them.
- **File**: `game/server/providers.js` — no changes needed; persistence already saves `selectedDeck`.

## Verification: code
