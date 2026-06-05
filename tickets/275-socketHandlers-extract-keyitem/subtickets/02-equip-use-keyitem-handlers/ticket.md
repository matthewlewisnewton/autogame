# 02 — Extract equipKeyItem and useKeyItem handlers

Move the remaining key-item socket handlers from `lobbyHandlers.js` into `keyItemHandlers.js` and clean up `lobbyHandlers.js` so all key-item handlers live in the key-item module. This completes ticket 275.

## Acceptance Criteria

- `equipKeyItem` and `useKeyItem` are registered only in `keyItemHandlers.register`; no inline copies remain in `lobbyHandlers.js`.
- Handler behavior is unchanged:
  - `equipKeyItem` uses `withLobbyPlayer` with `requirePhase: 'lobby'` and `phaseMismatch: { event: 'keyItemError', payload: { reason: 'not_in_lobby' } }`, validates `keyItemId` via `getKeyItemDef`, sets `player.equippedKeyItemId`, calls `savePlayerData`, emits `keyItemEquipped` or `keyItemError`.
  - `useKeyItem` remains a thin delegate: `withLobbyFromSocket` → `keyItemEffects.handleUseKeyItem(socket, state, lobby, data)`.
- `lobbyHandlers.js` no longer imports `keyItemEffects` or `getKeyItemDef` unless still used by non-key-item handlers.
- `lobbyHandlers.js` header comment reflects that key-item handlers live in `keyItemHandlers.js`.
- `index.js` is unchanged (registration stays `lobbyHandlers.register` → `keyItemHandlers.register`).
- `cd game && pnpm test:quick` passes (including `key-items.test.js`, `dodge_roll.test.js`, `phase_step.test.js`, `loot_magnet.test.js`, and other key-item integration tests).

## Technical Specs

- **Edit:** `game/server/socketHandlers/keyItemHandlers.js`
  - Move handler bodies from `lobbyHandlers.js`:
    - `equipKeyItem` (~L178–200)
    - `useKeyItem` (~L202–206)
  - Import `getKeyItemDef`, `savePlayerData` from `../progression`.
  - Import `keyItemEffects` from `../keyItemEffects`.
  - Read from `ctx`: `withLobbyPlayer`, `withLobbyFromSocket`.
- **Edit:** `game/server/socketHandlers/lobbyHandlers.js`
  - Remove `equipKeyItem` and `useKeyItem` handler registrations.
  - Remove `keyItemEffects` require and `getKeyItemDef` from progression imports if no longer needed.
  - Ensure header comment lists key-item handlers under `keyItemHandlers.js`.
- Do not move non-key-item handlers (`unlockHat`, `medicHeal`, run lifecycle, playing phase, etc.).

## Verification: code
