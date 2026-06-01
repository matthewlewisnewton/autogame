# 03 — Tests: Flare Beacon reveal

Unit tests for the Flare Beacon server logic: verify that enemies in range get `revealedUntil`, enemies out of range do not, and cooldown is enforced.

## Acceptance Criteria

- Test file exists at `game/server/test/flare_beacon.test.js`
- Test: enemy within `revealRadius` of player gets `revealedUntil` set to `now + revealDurationMs`
- Test: enemy outside `revealRadius` does **not** get `revealedUntil` set
- Test: dead enemies are skipped (do not get `revealedUntil`)
- Test: cooldown is enforced — second use within 10s returns `on_cooldown`
- Test: `keyItemUsed` response includes `ok: true` and `revealed` count
- All tests pass with `pnpm test`

## Technical Specs

**File to create:**

- `game/server/test/flare_beacon.test.js`

Follow the pattern from `dodge_roll.test.js`:
- Import `gameState`, `createGameState`, `KEY_ITEM_DEFS` from `../index.js`
- Use `resetState()` helper to reset game state before each test
- Set up a minimal layout with `gameState.layout` and `gameState.walkableAABBs`
- Place player and enemies at known coordinates
- Simulate `useKeyItem` by calling the internal handler logic directly, or by using a mock socket connection
- Verify `enemy.revealedUntil` values on enemies after the call

Key test scenarios:
1. **Basic reveal**: 2 enemies, one at 5m, one at 30m — only the close one gets revealed
2. **Dead enemy skip**: enemy with `hp <= 0` is not modified
3. **Cooldown gate**: use twice in quick succession, second returns `on_cooldown`
4. **Revealed count**: `keyItemUsed` response has correct `revealed` count
5. **Definition check**: `KEY_ITEM_DEFS.flare_beacon` has `revealRadius: 25`, `revealDurationMs: 3000`, `cooldownMs: 10000`

## Verification: code
