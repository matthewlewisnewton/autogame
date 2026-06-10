# Update tests for revived HP floor in revivePlayerInLobby()

## Description

After wiring `LOBBY_REVIVE_HP` into `revivePlayerInLobby()`, existing tests that assert on the old behavior (dead players revived at 0 HP) will fail. Update the test expectations to match the new behavior: revived players get `LOBBY_REVIVE_HP` (10) HP instead of 0.

## Acceptance Criteria

- `game/server/test/server.test.js` — `revivePlayerInLobby()` tests (line ~3792): update the two tests that assert `hp: 0` after revive to assert `hp: LOBBY_REVIVE_HP` (10) instead; `dead` should still be `false`
- `game/server/test/integration.test.js` — reconnect test (line ~5216): update `expect(restoredPlayer.hp).toBe(0)` to `expect(restoredPlayer.hp).toBe(LOBBY_REVIVE_HP)` and `expect(restoredPlayer.dead).toBe(true)` to `expect(restoredPlayer.dead).toBe(false)`
- All existing tests pass after updates (`pnpm test` from `game/`)
- Test descriptions/names are updated to reflect the new behavior (e.g., "clears dead flag and restores LOBBY_REVIVE_HP")

## Technical Specs

- **File**: `game/server/test/server.test.js`
  - Line ~3798: test "clears dead flag without raising HP for dead players" → change name to mention LOBBY_REVIVE_HP, change `expect(player.hp).toBe(0)` to `expect(player.hp).toBe(LOBBY_REVIVE_HP)`
  - Line ~3805: test "clears dead flag without raising HP for zero-HP players" → same changes
  - Import `LOBBY_REVIVE_HP` from `../config.js` if not already imported (check line ~47)
- **File**: `game/server/test/integration.test.js`
  - Line ~5216: update HP and dead expectations after reconnect
  - Import `LOBBY_REVIVE_HP` if needed

## Verification: code
