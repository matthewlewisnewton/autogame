# Client: Smoke Veil VFX wiring

## Description

Connect Smoke Veil to the existing `triggerSmokeVFX` helper in `renderer.js`, which already animates a ~2s grey fog disc and can refresh from `stateUpdate` when `smokeVeilUntil` / `smokeVeilX` / `smokeVeilZ` / `smokeVeilRadius` are present. Ensure the local player gets immediate feedback on use and that observers see the veil at the fixed cast point for the full duration.

## Acceptance Criteria

- On successful `keyItemUsed` for `smoke_bomb`, `main.js` calls `triggerSmokeVFX` at the caster’s current `{ x, z }` with def radius (or `SMOKE_RADIUS`) and `playerId`, so the caster sees fog without waiting for the next snapshot.
- The existing `stateUpdate` path in `renderer.js` continues to spawn/maintain smoke for any player with `smokeVeilUntil > Date.now()` at `(smokeVeilX, smokeVeilZ)` (fixed cast point, not live player position).
- `flashKeyItemIndicator('success')` still runs for smoke bomb (no regression to other key items).
- No duplicate overlapping smoke meshes for one player when both `keyItemUsed` and snapshot fire in the same frame (reuse `smokeVFX[playerId]` replacement logic).

## Technical Specs

- **`game/client/main.js`**: Import `triggerSmokeVFX` from `renderer.js`; in the `keyItemUsed` handler, add a branch for `data.keyItemId === 'smoke_bomb'` that reads local position from `gameState.players[myId]` and calls `triggerSmokeVFX({ x, z }, radius, myId)`.
- **`game/client/renderer.js`**: Only adjust if snapshot field names from the server differ from `smokeVeilX` / `smokeVeilZ` / `smokeVeilRadius` / `smokeVeilUntil`; keep fixed cast-point behavior documented in the existing comment block (~lines 2889–2893).

## Verification: code
