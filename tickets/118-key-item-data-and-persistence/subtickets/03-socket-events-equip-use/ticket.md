# Socket Events for Equip and Use Key Item

Implement `equipKeyItem` (lobby-safe) and `useKeyItem` (dungeon-only) socket handlers. Validate the key item ID, enforce cooldown gating on use, and broadcast state back to the client.

## Acceptance Criteria
- Socket event `equipKeyItem` accepts `{ keyItemId }`, validates that the ID exists in `KEY_ITEM_DEFS`, and is only allowed when game phase is `lobby`
- On successful equip: set `player.equippedKeyItemId`, emit confirmation back to the player socket with the new equipped ID
- Socket event `useKeyItem` is accepted only when game phase is `playing` (active dungeon run)
- `useKeyItem` rejects with structured error when `keyItemCooldownUntil > Date.now()` (returns `{ ok: false, reason: 'on_cooldown', remainingMs: ... }`)
- `useKeyItem` rejects with structured error for unknown key item ID (returns `{ ok: false, reason: 'unknown_item' }`)
- `useKeyItem` for `dodge_roll` sets `keyItemCooldownUntil` to `Date.now() + cooldownMs` and returns `{ ok: true }` (motion is ticket 121; this sub-ticket just gates + sets cooldown)
- `useKeyItem` for non-`dodge_roll` items returns `{ ok: false, reason: 'not_implemented' }`

## Technical Specs
- **File:** `game/server/index.js`
  - Add `socket.on('equipKeyItem', ...)` handler inside `io.on('connection')` — follow `deckAddCard` pattern (lobby-only, validate, mutate, emit result)
  - Add `socket.on('useKeyItem', ...)` handler — follow `useCard` pattern (run-only, validate cooldown, set cooldown, emit result)
  - Both handlers use `withLobbyFromSocket` and `socket.playerId` to resolve player state
  - Import `KEY_ITEM_DEFS` and `getKeyItemDef` from `progression.js`

## Verification
- `Verification: code`
