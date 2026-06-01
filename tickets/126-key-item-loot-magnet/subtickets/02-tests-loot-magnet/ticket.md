# Tests: loot magnet pull & collect

Add unit/integration tests for the `loot_magnet` key item: verify loot within range moves closer, loot within pickup range gets auto-collected, out-of-range loot is untouched, already-collected loot is ignored, and cooldown is enforced.

## Acceptance Criteria

- New test file `game/server/test/loot_magnet.test.js` exists and passes.
- Test: loot entity placed within `attractRadius` (8 m) moves closer to player after `useKeyItem`.
- Test: loot entity placed within `LOOT_PICKUP_RADIUS` (3.5 m) is auto-collected (removed from `state.loot`, player currency/MS credited).
- Test: loot entity placed outside `attractRadius` is untouched (position unchanged, still in `state.loot`).
- Test: emitting `useKeyItem` for already-collected loot (not in `state.loot`) does not error or double-credit.
- Test: second `useKeyItem` within cooldown returns `{ ok: false, reason: 'on_cooldown' }`.
- Test: response object contains `pulled` and `collected` counts that match expected values.
- Test: loot pulled through a wall stops at the wall boundary (uses a room layout with walls; verify loot doesn't cross wall line).

## Technical Specs

**Files to create:**

- `game/server/test/loot_magnet.test.js`:
  - Use `startTestServer()` / `closeServer()` from `test/helpers.js`
  - Helper `connectAndStartRun()` to connect socket, ready up, and start game
  - Manually push loot entities into `state.loot` at known offsets from player position
  - Clear `player.keyItemCooldownUntil = 0` before each test
  - Emit `useKeyItem { keyItemId: 'loot_magnet' }`, assert on `keyItemUsed` response and `state.loot`
  - For wall test: use `buildSmallRoom()`-style layout (similar to `dodge_roll.test.js`) with walls, place loot on opposite side of wall from player, verify loot stops at wall

## Verification: code
