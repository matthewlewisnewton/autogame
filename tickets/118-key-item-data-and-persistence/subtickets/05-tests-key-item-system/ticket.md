# Tests for Key Item System

Add unit tests covering key item equip persistence, cooldown rejection, and unknown ID rejection. Follow existing test patterns in the project.

## Acceptance Criteria
- Test: equipping a valid key item via socket and verifying `player.equippedKeyItemId` is set
- Test: equipping an unknown key item ID is rejected (handler returns error or no-ops)
- Test: `useKeyItem` is rejected when `keyItemCooldownUntil > Date.now()` with `{ ok: false, reason: 'on_cooldown' }`
- Test: `useKeyItem` is rejected for unknown key item ID with `{ ok: false, reason: 'unknown_item' }`
- Test: `useKeyItem` for `dodge_roll` sets `keyItemCooldownUntil` to a future timestamp
- Test: `useKeyItem` for non-`dodge_roll` items returns `{ ok: false, reason: 'not_implemented' }`
- Test: equipped key item persists through `extractPersistentData` / restore cycle
- Test: `getUnlockedKeyItems()` returns all 14 key item definitions

## Technical Specs
- **File:** `game/server/test/key-items.test.js` (new file, or add to existing test file if one covers progression/socket handlers)
  - Use existing test infrastructure (vitest, test providers, mock socket helpers)
  - Follow patterns from existing tests (check `game/server/test/` or `game/scripts/` for test location and style)
  - Use `setTestProvider` with `InMemoryProvider` for isolation
  - For socket handler tests, use the existing socket test helpers or mock the socket/connection

## Verification
- `Verification: code`
