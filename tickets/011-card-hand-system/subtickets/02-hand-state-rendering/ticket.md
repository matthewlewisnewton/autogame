# Hand State & Card Rendering

Wire up the client-side hand state and populate the 4 existing HUD card slots with card names, type colors, and type icons from the card data module.

## Acceptance Criteria
- On game start (after `startGame`), the player is dealt an initial hand of 4 cards from `createStartingDeck()`
- Each of the 4 `.card-slot` elements in the HUD displays the card's name text and a type icon
- Each slot's border or background reflects the card's type color from `CARD_TYPE_STYLE`
- The remaining deck is stored in a client-side array; cards are drawn from it when a slot needs refilling
- Hand state (array of 4 card objects, each with `id`, `name`, `type`, `charges`, `remainingCharges`) is maintained in `main.js`

## Technical Specs
- **Files**: `game/client/main.js`, `game/client/style.css`
- Import `CARD_DEFS`, `createStartingDeck()`, `CARD_TYPE_STYLE` from `./cards.js`
- Add `hand` (array of 4 card objects) and `deck` (remaining cards) state variables to `main.js`
- Create `renderHand()` function that iterates the 4 hand slots and updates DOM content (name, icon, type color) on each `.card-slot`
- Call `renderHand()` in the `startGame` handler after initializing the hand
- Update `.card-slot` CSS: add `pointer-events: auto`, `display: flex`, `flex-direction: column`, `align-items: center`, `justify-content: center`, and inner spans for name/icon with readable styling
- Each `.card-slot` should get a `data-slot-index` attribute (0–3) for later handler wiring

## Verification: code
