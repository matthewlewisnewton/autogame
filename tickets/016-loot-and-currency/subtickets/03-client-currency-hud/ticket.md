# Currency HUD Element

Add a "GOLD" counter to the HUD that displays the local player's current `currency` value from the server state.

## Acceptance Criteria
- `index.html` contains a new HUD element with `id="currency-display"` (or similar) showing the label "GOLD" and the player's currency value
- `style.css` contains styling for the currency display, positioned below the Magic Stones bar (e.g. `top: 68px`)
- `main.js` reads `gameState.players[myId].currency` and updates the HUD text on every `stateUpdate`
- The display format is `GOLD {value}` (e.g. `GOLD 0`, `GOLD 15`)

## Technical Specs
- **Files**: `game/client/index.html`, `game/client/style.css`, `game/client/main.js`
- In `index.html`, add inside `#ui`:
  ```html
  <div id="currency-display">GOLD 0</div>
  ```
- In `style.css`, add styling for `#currency-display` matching the existing bar containers (absolute position, `top: 68px`, `left: 50%`, `transform: translateX(-50%)`, `font-size: 13px`, `font-weight: 700`, `color: #fbbf24`, `text-shadow`, `pointer-events: none`, `z-index: 11`)
- In `main.js`, inside the `socket.on('stateUpdate', …)` handler, after `gameState = state`, add:
  ```js
  if (myId && gameState.players[myId]) {
    document.getElementById('currency-display').textContent = `GOLD ${gameState.players[myId].currency}`;
  }
  ```

## Verification: code
