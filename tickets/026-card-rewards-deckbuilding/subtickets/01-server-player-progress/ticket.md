# Server Player Progress State

Add server-owned session inventory to each player: `currency`, `ownedCards` (a map of card id → count), and `runRewards` (latest reward summary). New players receive the starting deck's card ids in their inventory and zero currency.

## Acceptance Criteria
- A `createPlayerProgress()` helper exists that returns `{ currency: 0, ownedCards: {}, runRewards: null }`.
- The starting deck's unique card ids are pre-populated in `ownedCards` with count 1 each (so a new player owns `iron_sword`, `flame_blade`, `battle_familiar`, `dungeon_drake`).
- On socket connection, each new player is initialized with `currency: 0` and the starting deck's card ids in `ownedCards`.
- `createPlayerProgress()` is exported from `game/server/index.js` for test imports.
- Unit test: a freshly created player progress has `currency: 0` and owned cards matching the starting deck.

## Technical Specs
- **File**: `game/server/index.js`
  - Add `createPlayerProgress()` function that builds `{ currency: 0, ownedCards: { iron_sword: 1, flame_blade: 1, battle_familiar: 1, dungeon_drake: 1 }, runRewards: null }`.
  - Import or reference `createStartingDeck` logic. Since `createStartingDeck` lives in client-side `cards.js` (ES module), duplicate the starting deck card ids as a small constant array in the server (e.g., `STARTING_DECK_IDS = ['iron_sword', 'flame_blade', 'battle_familiar', 'dungeon_drake', 'iron_sword', 'iron_sword', 'battle_familiar', 'flame_blade']`) and derive unique ids from it.
  - In the `io.on('connection')` handler, after creating the player object, merge progress state: `player.currency = 0`, `player.ownedCards = createPlayerProgress().ownedCards`, `player.runRewards = null`.
  - Export `createPlayerProgress` in the module.exports block.
- **File**: `game/server/test/server.test.js`
  - Add unit tests for `createPlayerProgress()`: checks currency is 0, ownedCards has the 4 unique starting card ids each at count 1, runRewards is null.

## Verification: code
