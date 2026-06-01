# 03 — Tests: Overclock key item

Add integration tests for the overclock key item covering key item activation, cooldown bypass, charge consumption, and normal cooldown restoration after charges are exhausted.

## Acceptance Criteria

- Test: using `overclock` key item sets `overclockChargesRemaining` to 2 and applies key item cooldown.
- Test: with overclock active, playing a card does NOT set `slotCooldowns` on that slot and decrements `overclockChargesRemaining`.
- Test: playing a second card from the same slot immediately after the first succeeds (no slot cooldown) and consumes the last charge.
- Test: after both charges are consumed, a third card play from the same slot respects the normal slot cooldown.
- Test: overclock does not bypass MS cost — card still consumes magic stones.
- Test: `overclockChargesRemaining` is included in `stateSnapshot` and visible in `stateUpdate`.
- All tests pass with `pnpm test`.

## Technical Specs

- **`game/server/test/overclock.test.js`** (new file):
  - Follow the pattern in `loot_magnet.test.js`: use `startTestServer`, `connectClient`, `waitForEvent`, `playerForSocket`, `testGameState`.
  - Helper `connectAndStartRun()` that connects a client and starts a solo run.
  - Tests:
    1. `"useKeyItem overclock sets 2 charges"` — emit `useKeyItem({ keyItemId: 'overclock' })`, assert response has `ok: true, charges: 2`, assert `player.overclockChargesRemaining === 2`.
    2. `"first card play with overclock skips slot cooldown"` — play a card, assert `slotCooldowns[slotIndex]` is still `null`/`undefined`, assert `overclockChargesRemaining === 1`.
    3. `"second rapid card play from same slot succeeds"` — immediately play same card again, assert `cardUsed` fires (not `cardError`), assert `overclockChargesRemaining === 0`.
    4. `"third card play respects slot cooldown after charges exhausted"` — play a third time, wait for cooldown to expire, verify that the slot now has a cooldown set.
    5. `"overclock does not bypass MS cost"` — record `player.magicStones` before and after, assert it decreased.
    6. `"overclockChargesRemaining appears in stateSnapshot"` — call `stateSnapshot()`, assert player entry has `overclockChargesRemaining`.

## Verification: code
