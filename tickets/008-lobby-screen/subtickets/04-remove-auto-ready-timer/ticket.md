# 04 — Remove Auto-Ready Timer from Production Code

The `init` handler in `main.js` contains a `setTimeout(..., 4000)` that auto-emits `playerReady` and flips the button label without user action. This was added as test scaffolding but permanently makes the lobby self-dismiss after 4 seconds for every real player, defeating the opt-in lobby gate.

Remove the entire `setTimeout` block from the `init` handler so that a player only becomes ready by explicitly clicking the Ready button.

## Acceptance Criteria
- The `socket.on('init', ...)` handler in `main.js` contains **no** `setTimeout` that emits `playerReady` or modifies `readyBtn.textContent`
- A single player who joins the lobby sees the "Ready" button but is **not** auto-readied after any delay
- The lobby remains visible until the player manually clicks the Ready button

## Technical Specs
- **`game/client/main.js`** — Delete the `setTimeout` block inside `socket.on('init', ...)` (the 4-second auto-ready timer and its comment). Leave the `gamePhase === 'playing'` early-return branch intact.

## Verification: code
