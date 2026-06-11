# Replace Object.entries(gs.players) in animate() player loops

`syncPlayerMeshes` iterates players twice per frame with `Object.entries(gs.players)`, and `syncPhaseStepAllyHighlight` (called from `animate()`) does the same. Each call allocates a temporary `[key, value]` array. Switch to `Object.keys` + direct `gs.players[id]` lookup so the hot path allocates nothing for iteration.

## Acceptance Criteria

- `syncPlayerMeshes` main player loop uses `Object.keys(gs.players)` (or equivalent zero-allocation iteration) instead of `Object.entries`
- The smoke-bomb VFX loop at the bottom of `syncPlayerMeshes` uses the same zero-allocation iteration pattern
- `syncPhaseStepAllyHighlight` in `renderer.js` uses `Object.keys` instead of `Object.entries`
- Player avatar sync, nameplates, slow/burn indicators, and phase-step ally highlight behavior are unchanged
- `pnpm test:quick` passes

## Technical Specs

- **File:** `game/client/renderer/playerSync.js`
  - Line ~78: replace `for (const [id, pData] of Object.entries(gs.players))` with `for (const id of Object.keys(gs.players))` and `const pData = gs.players[id]`
  - Line ~314: same replacement for the smoke-bomb loop
- **File:** `game/client/renderer.js`
  - In `syncPhaseStepAllyHighlight(gs, myId)` (~line 3828): replace `Object.entries` with `Object.keys` + `gs.players[id]`
- Guard against missing/undefined player records the same way the current loops implicitly do

## Verification: code
