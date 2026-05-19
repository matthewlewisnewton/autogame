# Client Hand Init From Server Deck

Replace the client's `initHand()` so that instead of building a deck from `createStartingDeck()`, it uses the server-provided `deck` array from the `stateUpdate` payload. Existing card input, cooldowns, and summon behavior must continue working.

## Acceptance Criteria
- When the client receives `startGame`, it reads the server's `deck` array from `gameState.players[myId].deck` and initializes its local `deck` and `hand` from it.
- If the server deck is empty or missing, the client falls back to `createStartingDeck()` (defensive guard).
- The `hand` module exposes a function `initHandFromDeck(serverDeckIds, onRender)` that takes an array of card id strings and deals the first 4 into the hand.
- Existing key input (1-4), cooldowns, summon rejection rollback, and monster-card behavior work identically with server-provided decks.
- The old `initHand()` (which calls `createStartingDeck()`) is either replaced or kept as a fallback.
- Client test: `initHandFromDeck()` with a known array of card ids produces a hand of 4 cards and a remaining deck.

## Technical Specs
- **File**: `game/client/hand.js`
  - Add `export function initHandFromDeck(serverDeckIds, onRender)`:
    - Validate `serverDeckIds` is a non-empty array; if not, fall back to `createStartingDeck()`.
    - Reset `hand = []`, `deck = []`, `slotCooldowns = [false, false, false, false]`.
    - Push all server deck ids into `deck` (reversed so `pop()` gives original order).
    - Deal first 4 cards via `drawCard()` into `hand`.
    - Call `onRender` if provided.
- **File**: `game/client/main.js`
  - In the `startGame` socket handler, replace `initHand()` with:
    ```js
    const serverDeck = (gameState && gameState.players && gameState.players[myId]) ? gameState.players[myId].deck : null;
    initHandFromDeck(serverDeck, renderHand);
    ```
  - For the initial `init` path (when connecting mid-game), also use `initHandFromDeck` if `gameState.players[myId].deck` is available.
- **File**: `game/client/test/cards.test.js` or `game/client/test/hand.test.js`
  - Test: `initHandFromDeck(['iron_sword', 'flame_blade', 'battle_familiar', 'dungeon_drake', 'iron_sword'], null)` produces hand of 4 cards and deck of 1.
  - Test: `initHandFromDeck(null, null)` falls back to `createStartingDeck()`.

## Verification: code
