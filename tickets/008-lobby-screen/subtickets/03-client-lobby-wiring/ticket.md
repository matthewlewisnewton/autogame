# 03 — Client-Side Lobby Event Wiring

Wire the lobby UI to the socket events introduced in sub-ticket 02. The client listens for `lobbyUpdate` to populate the player list, emits `playerReady` when the Ready button is clicked, and transitions to the 3D game on `startGame`.

## Acceptance Criteria
- On receiving `lobbyUpdate`, the client renders each player's ID in `#lobby-player-list` with a ready/not-ready indicator (e.g., text "Ready" or "Not Ready" next to the ID)
- Clicking the "Ready" button emits `playerReady` to the server and toggles the button label (e.g., "Ready" → "Ready!")
- On receiving `startGame`, the lobby div is hidden, `#ui` and `#card-hand` become visible, and `initScene()` is called to initialize the Three.js scene
- The 3D scene renders correctly after transition (floor, lights, player cube, WASD movement works)
- With a single player: join → click Ready → lobby disappears → 3D scene appears immediately

## Technical Specs
- **`game/client/main.js`** — Add `socket.on('lobbyUpdate', (data) => { ... })` to clear and repopulate `#lobby-player-list` from `data.players`. Add click handler on `#ready-btn` that emits `socket.emit('playerReady')` and toggles button text. Add `socket.on('startGame', () => { ... })` that hides `#lobby`, shows `#ui` and `#card-hand`, then calls `initScene()`.
- **`game/client/style.css`** — Add `.hidden { display: none; }` utility class (or use inline `style.display`) to toggle visibility of `#lobby`, `#ui`, and `#card-hand`.

## Verification: visual
