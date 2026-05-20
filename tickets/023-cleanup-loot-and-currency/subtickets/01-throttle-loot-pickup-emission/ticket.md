# Throttle per-frame loot pickup emission

The client currently emits `lootPickup` every animation frame while a player stands on a loot item. Add a set of "already-emitted" loot IDs on the client so each loot item triggers at most one emit. Clear the set when the server's `stateUpdate` removes the loot from `gameState.loot`.

## Acceptance Criteria
- Standing on a loot item emits `lootPickup` exactly once (not once per frame).
- After the server removes the loot (via `stateUpdate`), the throttle is cleared so a respawned item of the same ID could be picked up again.
- Pickup still works the moment a player walks over loot (no added delay).

## Technical Specs
- **File:** `game/client/main.js` — `animate()` function, loot proximity block (~line 1441)
- Add a `Set` (e.g., `pickedUpLootIds`) to track loot IDs already emitted.
- Before `socket.emit('lootPickup', ...)`, check `!pickedUpLootIds.has(loot.id)`.
- After each `stateUpdate`, diff `gameState.loot` against the set and remove any IDs no longer present in the loot array.
- **File:** `game/server/test/integration.test.js` — add a test that verifies only one `lootPickup` is processed per loot ID (server idempotency already handles dupes, but the client-side throttle is what we're verifying via the emit count or a mock).

## Verification: code
