# 08 — Client renderer and character booth use shared emit constants

Production client modules outside `main.js` still emit raw wire strings on normal gameplay paths. Wire `renderer.js` and `characterBooth.js` to `CLIENT_TO_SERVER` so movement, loot pickup, booth interaction, hat unlock, and appearance changes cannot drift from the shared catalog.

## Acceptance Criteria

- `game/client/renderer.js` imports `CLIENT_TO_SERVER` from `game/shared/events.json` (same `import … with { type: 'json' }` pattern as `main.js`).
- Every `socketRef.emit(` first argument in `renderer.js` uses `CLIENT_TO_SERVER.*` for custom game events: `MOVE` (rotation-only and movement emits), `LOOT_PICKUP`, and `BOOTH_INTERACT`.
- `game/client/characterBooth.js` imports `CLIENT_TO_SERVER` from `game/shared/events.json`.
- Every `socket.emit(` first argument in `characterBooth.js` uses `CLIENT_TO_SERVER.UNLOCK_HAT` and `CLIENT_TO_SERVER.APPLY_APPEARANCE_CHANGE` (not string literals).
- No custom event string literals remain in any `socketRef.emit(` / `socket.emit(` first argument in those two files.
- Emit payloads, retry timing, and handler logic are unchanged.
- `cd game && pnpm test:quick` passes.

## Technical Specs

- **Edit:** `game/client/renderer.js`, `game/client/characterBooth.js`.
- Add at top of each file:
  ```js
  import eventsCatalog from '../shared/events.json' with { type: 'json' };
  const { clientToServer: CLIENT_TO_SERVER } = eventsCatalog;
  ```
- Replace literals at these call sites:
  - `renderer.js`: `socketRef.emit('move', …)` (two locations), `socketRef.emit('lootPickup', …)`, `socketRef.emit('boothInteract', …)`.
  - `characterBooth.js`: `socket.emit('unlockHat', …)`, `socket.emit('applyAppearanceChange', …)`.
- Do not add new catalog entries; keys already exist in `game/shared/events.json`.
- Do not modify passed sub-tickets 01–07, harness files, or review artifacts.

## Verification: code
