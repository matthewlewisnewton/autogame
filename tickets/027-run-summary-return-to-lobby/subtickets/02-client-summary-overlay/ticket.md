# Client Summary Overlay

Add a summary overlay on the client that appears when the server emits `runComplete` or `runFailed`, displaying run results and a "Return to Lobby" button.

## Acceptance Criteria
- A `#run-summary-overlay` div is added to `index.html` containing:
  - A status heading (e.g. "Victory!" or "Run Failed")
  - A duration display
  - A defeated enemies count
  - A currency collected count
  - A `#return-to-lobby-btn` button
- The overlay is hidden by default and shown when the client receives `runComplete` or `runFailed`
- The overlay populates its fields from the event payload (`durationMs`, `defeatedEnemies`, `currencyCollected`, `status`)
- Duration is formatted as a human-readable string (e.g. "1m 23s" or "45s")
- The overlay has a semi-transparent background and is centered on screen (z-index above gameplay HUD)
- The gameplay HUD (`#ui`) and card hand (`#card-hand`) remain visible behind the overlay
- Clicking `#return-to-lobby-btn` emits a `returnToLobby` socket event
- The overlay hides again when the server sends a `stateUpdate` with `gamePhase === 'lobby'`

## Technical Specs
- **File**: `game/client/index.html` — add `#run-summary-overlay` div with child elements: `#summary-status`, `#summary-duration`, `#summary-enemies`, `#summary-currency`, `#return-to-lobby-btn`
- **File**: `game/client/style.css` — style the overlay: fixed position, centered, semi-transparent dark background, z-index 200 (above lobby z-index 100), white text, button styling matching existing `#ready-btn` style
- **File**: `game/client/main.js` — add:
  - `socket.on('runComplete', showRunSummary)` handler
  - `socket.on('runFailed', showRunSummary)` handler
  - `showRunSummary(data)` function: reads `data.status`, `data.durationMs`, `data.defeatedEnemies`, `data.currencyCollected`; formats duration; populates overlay DOM elements; sets overlay display to block
  - `formatDuration(ms)` helper: converts milliseconds to "Xm Ys" or "Ys" string
  - `#return-to-lobby-btn` click listener: `socket.emit('returnToLobby')`
  - In `socket.on('stateUpdate')`: when `state.gamePhase === 'lobby'`, hide the overlay (`display: none`)

## Verification: code
