# Mark quest crystals as quest-critical and skip lifetime expiry

Quest-objective crystals (`kind: 'crystal'`) spawned by `spawnCrystals()` get filtered out by the `LOOT_LIFETIME_MS` cleanup in the game loop, making `collect_items` quests unwinnable after 2 minutes.

Mark crystal loot with a `questCritical: true` flag and update the lifetime filter to skip such items.

## Acceptance Criteria
- Every loot entry with `kind === 'crystal'` pushed by `spawnCrystals()` includes `questCritical: true`
- The loot lifetime filter in `game/server/index.js` skips removal of loot entries where `questCritical` is `true`
- Ordinary (non-quest-critical) loot still expires after `LOOT_LIFETIME_MS` (120000 ms)
- All existing tests still pass

## Technical Specs
- **`game/server/progression.js`** (~line 2540): In `spawnCrystals()`, add `questCritical: true` to the object pushed into `_gameState.loot`
- **`game/server/index.js`** (~line 1538): Change the filter from
  ```js
  state.loot = state.loot.filter(l => (now - l.createdAt) < LOOT_LIFETIME_MS);
  ```
  to
  ```js
  state.loot = state.loot.filter(l => l.questCritical || (now - l.createdAt) < LOOT_LIFETIME_MS);
  ```

## Verification: code
