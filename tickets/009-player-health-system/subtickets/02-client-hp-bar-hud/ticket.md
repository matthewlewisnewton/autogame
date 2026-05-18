# Client: HP Bar HUD

Render an HP bar for every player in the game HUD, updating from the `hp` values received in `stateUpdate` broadcasts.

## Acceptance Criteria
- An HP bar element exists in the DOM for each connected player
- The HP bar width reflects the player's current `hp` as a percentage of 100 (e.g., 50 hp → 50% width)
- The HP bar updates every frame from the latest `gameState.players` data in `stateUpdate`
- The HP bar is visually associated with its player (labelled with the player ID or positioned near the player's mesh)
- Only the local player's HP bar is required; remote players' bars are nice-to-have but not blocking

## Technical Specs
- **Files**: `game/client/index.html`, `game/client/style.css`, `game/client/main.js`
- Add a `#hp-bar-container` (or similar) div in `index.html` inside the `#ui` block
- Style the HP bar in `style.css` — a green bar on a dark background, positioned near the top of the screen
- In `main.js`, in the `animate()` loop (or a dedicated update function called each frame), read `gameState.players[myId].hp` and set the HP bar's width/style accordingly
- Create a helper like `updateHpBar(hp)` that computes percentage and applies it

## Verification: code
