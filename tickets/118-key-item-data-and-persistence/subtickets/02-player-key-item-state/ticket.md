# Player Key Item State Fields

Add `equippedKeyItemId` and `keyItemCooldownUntil` to the player record. Initialize new players with `dodge_roll` as the default equipped key item. Provide a helper to query all unlocked key items (all 14 are unlocked at start).

## Acceptance Criteria
- Player objects include `equippedKeyItemId` (nullable string, default `'dodge_roll'`)
- Player objects include `keyItemCooldownUntil` (timestamp ms, default `0` meaning ready)
- New players created via `createPlayer()` or equivalent initialization path get `equippedKeyItemId: 'dodge_roll'`
- A helper `getUnlockedKeyItems()` returns all 14 key item definitions (all unlocked at start, no grind gate)
- Helper `isKeyItemUnlocked(player, keyItemId)` returns `true` for all defined key items

## Technical Specs
- **File:** `game/server/progression.js`
  - Add `equippedKeyItemId` and `keyItemCooldownUntil` fields to `createPlayerProgress()` initial state
  - Add `getUnlockedKeyItems()` — returns `Object.values(KEY_ITEM_DEFS)` (all unlocked)
  - Add `isKeyItemUnlocked(player, keyItemId)` — returns `keyItemId in KEY_ITEM_DEFS`
  - Export new helpers in `module.exports`
- **File:** `game/server/index.js`
  - When a player record is reconstructed on join (find where `createPlayer` or player init happens), ensure `equippedKeyItemId` defaults to `'dodge_roll'` if missing and `keyItemCooldownUntil` defaults to `0`

## Verification
- `Verification: code`
