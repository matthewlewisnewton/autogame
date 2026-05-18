# 05 — Fix Scene Initialization Double-Init Guard

`main.js` declares `let sceneInitialized = false;` and the `startGame` handler checks `if (sceneInitialized) return;`, but no code path ever assigns `sceneInitialized = true`. The guard is dead — a second `startGame` event would create a duplicate canvas and start a second render loop. Additionally, the `init` handler's `gamePhase === 'playing'` branch calls `initScene()` with no guard at all.

Set the flag to `true` after scene init and apply the guard to all code paths that call `initScene()`.

## Acceptance Criteria
- `initScene()` sets `sceneInitialized = true` at some point during or after its execution
- The `startGame` handler's `if (sceneInitialized) return;` guard is present and effective (a second `startGame` event does not create a second canvas)
- The `init` handler's `gamePhase === 'playing'` branch also checks `if (sceneInitialized) return;` before calling `initScene()`

## Technical Specs
- **`game/client/main.js`** — Add `sceneInitialized = true;` at the end of `initScene()` (after `clock` and `animate()` are started). Add `if (sceneInitialized) return;` at the top of the `gamePhase === 'playing'` branch inside `socket.on('init', ...)`, before the `lobbyEl.classList.add('hidden')` / `initScene()` calls.

## Verification: code
