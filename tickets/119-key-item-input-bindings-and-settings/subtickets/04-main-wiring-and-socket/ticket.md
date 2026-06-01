# Wire useKeyItem into main.js — Socket Emit and HUD Hook

Connect the `onUseKeyItem` callback from `initInput` to emit the `useKeyItem` socket event during active runs, and export a HUD-ready binding descriptor.

## Acceptance Criteria

- `initInput` in `main.js` passes `onUseKeyItem` callback that emits `useKeyItem` on the socket
- Socket emit only happens during an active run (`gameState.gamePhase === 'playing'`)
- Export `getUseKeyItemBinding()` from `input.js` returning the resolved keyboard key string and gamepad button hint for HUD display
- `getUseKeyItemBinding()` respects custom settings overrides (both keyboard and gamepad)

## Technical Specs

- **File**: `game/client/main.js`
  - Add `onUseKeyItem: () => { if (gameState && gameState.gamePhase === 'playing' && socket) socket.emit('useKeyItem'); }` to the `initInput()` call (around line 705)
- **File**: `game/client/input.js`
  - Export `getUseKeyItemBinding(): { key: string, gamepadHint?: string }` that returns the currently resolved keyboard key (from settings or default `'e'`) and the gamepad button hint label (from active profile or custom binding). Reuse the `describeStandardHandSlotBindingHint` pattern for gamepad hint generation.

## Verification: code
