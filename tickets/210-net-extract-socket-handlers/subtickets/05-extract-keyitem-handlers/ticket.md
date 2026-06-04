# 05-extract-keyitem-handlers

Extract key-item socket handlers into `socketHandlers/keyItems.js`, mirroring the existing `useCard` → `cardEffects` delegation pattern for `useKeyItem` → `keyItemEffects`.

## Acceptance Criteria

- [ ] New `game/server/socketHandlers/keyItems.js` exports `register(socket, ctx)` registering: `equipKeyItem` and `useKeyItem`
- [ ] `useKeyItem` remains a thin delegator to `keyItemEffects.handleUseKeyItem(socket, state, lobby, data)` inside `withLobbyFromSocket`
- [ ] `equipKeyItem` behavior unchanged (lobby-phase guard, def lookup, equip, save, `keyItemEquipped` emit)
- [ ] `registerAllSocketHandlers` calls `keyItems.register(socket, ctx)`
- [ ] No inline `socket.on(...)` for those two events remain in `game/server/index.js`
- [ ] `pnpm test` from `game/` is green (`game/server/test/key-items.test.js` passes)

## Technical Specs

- **New:** `game/server/socketHandlers/keyItems.js` — move `equipKeyItem` body from `index.js`; wire `useKeyItem` via `keyItemEffects` (already configured with `setCallbacks({ io })` in index — pass module reference through ctx or require directly without importing index)
- **Edit:** `game/server/socketHandlers/index.js` — wire `keyItems.register`
- **Edit:** `game/server/index.js` — remove extracted inline handlers

## Verification: code
