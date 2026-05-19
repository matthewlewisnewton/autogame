# Currency HUD Element (Verification)

The currency HUD was implemented in a previous round and reviewed as
code-correct. This sub-ticket verifies the existing implementation is intact
and properly integrated with the server `currency` field.

## Acceptance Criteria
- `game/client/index.html` contains `<div id="currency-display">GOLD 0</div>`
  inside `#ui`
- `game/client/style.css` has styling for `#currency-display` (absolute
  position, gold color `#fbbf24`, below the Magic Stones bar)
- `game/client/main.js` updates the HUD text on every `stateUpdate` by reading
  `gameState.players[myId].currency`
- The display format is `GOLD {value}` (e.g. `GOLD 0`, `GOLD 15`)
- `game/server/index.js` initializes `player.currency` to `0` on connect

## Technical Specs
- **Files** (read-only verification): `game/client/index.html`,
  `game/client/style.css`, `game/client/main.js`, `game/server/index.js`
- No code changes expected — this sub-ticket confirms the existing
  implementation is present and correct.

## Verification: code
