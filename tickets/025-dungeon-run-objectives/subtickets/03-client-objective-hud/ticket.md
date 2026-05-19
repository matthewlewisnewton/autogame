# Client Objective HUD

Render an objective progress HUD on the client that displays the current dungeon objective label and a `Defeated X / Y` counter. The HUD reads from server state and updates on every `stateUpdate`.

## Acceptance Criteria
- An HTML element with `id="objective-hud"` exists in `index.html`.
- The HUD is visible only when `gamePhase === 'playing'` and `gameState.run` exists.
- The HUD displays the objective label (e.g., `Defeat all enemies`) and progress text in the form `Defeated X / Y`.
- The HUD updates its `X` and `Y` values from `gameState.run.objective.defeatedEnemies` and `gameState.run.objective.totalEnemies` on every `stateUpdate`.
- The HUD does **not** infer progress from local mesh counts — it reads the server-supplied `run` object.
- The HUD is hidden when the game is in `'lobby'` phase or when `gameState.run` is absent.
- CSS styles the HUD so it is readable in-game (positioned, legible font, contrasting background).

## Technical Specs
- **File**: `game/client/index.html`
  - Add `<div id="objective-hud">` element inside the `#ui` container, below `#currency-display`.
- **File**: `game/client/style.css`
  - Add styles for `#objective-hud`: position it below the currency display (e.g., `top: 88px`), centered horizontally, with a semi-transparent dark background, white text, and appropriate padding/border-radius.
- **File**: `game/client/main.js`
  - In `socket.on('init', ...)`: after setting `gameState`, call a new `updateObjectiveHud()` function.
  - In `socket.on('stateUpdate', ...)`: call `updateObjectiveHud()` after the existing currency update.
  - In `socket.on('startGame', ...)`: show the HUD (or let `updateObjectiveHud` handle visibility based on `gamePhase`).
  - Add `updateObjectiveHud()` function: reads `gameState.run`, toggles `display` on `#objective-hud`, and sets inner text to `${run.objective.label}\nDefeated ${run.objective.defeatedEnemies} / ${run.objective.totalEnemies}`. If no run, hide the element.

## Verification: code
