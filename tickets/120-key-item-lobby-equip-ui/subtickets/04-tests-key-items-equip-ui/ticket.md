# Tests for Key Items Equip UI

Add unit tests for the key item list rendering, selection state, and socket emit behavior.

## Acceptance Criteria

- Test verifies that `renderKeyItemList()` creates one DOM entry per item in `keyItemDefs`
- Test verifies that the entry matching `equippedKeyItemId` carries the `.equipped` class
- Test verifies that clicking a non-equipped entry produces an `equipKeyItem` socket emit with the correct `keyItemId`
- Test verifies that `keyItemEquipped` socket event triggers a list re-render with updated selection
- Test verifies that `keyItemError` socket event displays error text in `#key-item-error`
- Tests pass with `pnpm test` (vitest)

## Technical Specs

- **File**: `game/client/test/main.test.js`
  - Add `describe('Key Items equip UI', ...)` block
  - In `beforeEach`, create required DOM elements: `#key-item-loadout`, `#key-item-list`, `#key-item-error`, `#lobby-tab-keyitems`
  - Test: "renderKeyItemList creates entries for all keyItemDefs" — set up mock `keyItemDefs`, call `window.renderKeyItemList()`, assert `#key-item-list` has `.key-item-entry` count matching `Object.keys(keyItemDefs).length`
  - Test: "equipped key item entry has .equipped class" — trigger `stateUpdate` with `equippedKeyItemId: 'dodge_roll'`, call `renderKeyItemList()`, assert correct entry has `.equipped` class and others don't
  - Test: "clicking key item entry emits equipKeyItem" — clear emit log, click a non-equipped entry, assert `equipKeyItem` emit with correct `keyItemId`
  - Test: "keyItemEquipped event re-renders list" — trigger `keyItemEquipped` socket event, assert list reflects new equipped item
  - Test: "keyItemError event shows error message" — trigger `keyItemError` socket event, assert `#key-item-error` is visible and contains error reason
  - Follow existing test patterns: use `window.__triggerSocketEvent()`, `window.__clearSocketEmitLog()`, `window.__socketEmitLog()`

## Verification: code
