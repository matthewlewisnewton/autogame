# Magic Stones Resource & HUD

Add a **Magic Stones** resource tracked per-player on the server and displayed in the client HUD. Magic Stones start at a maximum value and regenerate slowly over time.

## Acceptance Criteria
- Every new player is initialized with `magicStones` equal to a defined maximum (e.g. 100)
- `magicStones` regenerates by a small fixed amount each server tick (e.g. 0.5 per tick at 20 Hz ≈ 10/second), capped at the maximum
- `magicStones` is included in the `stateUpdate` broadcast so all clients receive it
- The client HUD displays a Magic Stones bar (or text readout) next to or below the HP bar, showing current/max values
- The HUD updates each frame from the latest `stateUpdate`

## Technical Specs
- **`game/server/index.js`**:
  - Define `MAX_MAGIC_STONES = 100` and `MAGIC_STONES_REGEN_PER_TICK = 0.5`
  - Add `magicStones: MAX_MAGIC_STONES` to the player object on connect
  - In the server game loop (`setInterval`), increment each player's `magicStones` by `MAGIC_STONES_REGEN_PER_TICK`, clamped to `MAX_MAGIC_STONES`
- **`game/client/index.html`**:
  - Add a Magic Stones HUD container (e.g. `<div id="ms-bar-container">`) below the HP bar, with label, bg, fill, and text children — mirror the HP bar structure
- **`game/client/style.css`**:
  - Style `#ms-bar-container` and children to match the HP bar style but with a distinct color (e.g. amber/gold to match summon card color `#f59e0b`)
- **`game/client/main.js`**:
  - Grab DOM refs for the new Magic Stones elements
  - In `animate()`, after the HP bar update, read `gameState.players[myId].magicStones` and update the Magic Stones bar fill width, text, and label (similar to `updateHpBar`)

## Verification: code
