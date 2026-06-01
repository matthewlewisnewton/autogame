# Key Item Persistence and Public State Snapshot

Ensure the equipped key item survives disconnect/reconnect by persisting `equippedKeyItemId` through the existing player data save/restore path. Expose equipped key item ID and cooldown remaining in the public state snapshot for HUD consumption.

## Acceptance Criteria
- `equippedKeyItemId` is included in `extractPersistentData(player)` so it survives `savePlayerData` / restore
- On player reconnect, the restored player record has the previously equipped key item ID
- `keyItemCooldownUntil` is NOT persisted (cooldowns reset on reconnect — it's run-state, not account-state)
- Public state snapshot (the object emitted to clients for game state) includes `equippedKeyItemId` and `keyItemCooldownRemaining` (computed as `max(0, keyItemCooldownUntil - Date.now())`) for each player
- The snapshot fields are available in the same structure the client receives for player state

## Technical Specs
- **File:** `game/server/progression.js`
  - Add `equippedKeyItemId` to `extractPersistentData(player)` — include it alongside currency, inventory, etc.
  - Ensure that when player data is restored (the reconstruction path), `equippedKeyItemId` is read back; default to `'dodge_roll'` if the field is missing from old saves
- **File:** `game/server/index.js`
  - Find where the public state snapshot is built and emitted to clients (likely in the game-loop tick or state broadcast). Add `equippedKeyItemId` and `keyItemCooldownRemaining` per player.
  - If snapshot is built inline, add fields to each player's snapshot entry. If there's a helper function, add fields there.

## Verification
- `Verification: code`
