# Heavy-hitter wind-up behavior and charge regression tests

Prove the tuned heavy hitters use the 307 deferred-resolution pipeline correctly: commitment during `windUpMs`, no early damage, full burst after resolution, and updated charge pools reflected in gameplay tests. Depends on sub-ticket 01 stat values.

## Acceptance Criteria

- `game/server/test/card_windup_resolution.test.js` (or a new `game/server/test/heavy_hitter_windup.test.js`) includes tests for **`flame_blade`** and **`soul_drain`** that mirror the existing `magma_greatsword` pattern:
  - `useCard` commits wind-up (`cardUseState === 'windup'`, `pendingCardUse` set) with **no** enemy HP change before `windUpMs` elapses.
  - After `processPendingCardWindups` (pin/advance `cardWindupStartTime` as in existing tests), the card resolves with **unchanged per-hit damage** (`flame_blade` 28, `soul_drain` 42 on a single grunt in range).
  - Commitment fields clear after resolution.
- Existing `magma_greatsword` wind-up tests still pass with **charges: 2** (update any hand seeds that still say `charges: 4`).
- `game/server/test/card_windup_types.test.js` or `card_windup_lock.test.js`: no regressions; update hardcoded `charges` on `magma_greatsword` hand fixtures if present.
- `game/server/test/integration.test.js` and `game/server/test/server.test.js`: update `flame_blade` / `magma_greatsword` hand seeds from old charge pools (3 / 4) to **2 / 2** where they assert `charges` on the card object.
- `game/client/test/main.test.js`: update `magma_greatsword` hand fixtures from `charges: 4` to **2**; card wind-up input-lock tests still pass.
- Instant-card regression (`iron_sword` without `windUpMs`) unchanged and still passes.
- `cd game && pnpm test:quick` passes.

## Technical Specs

- **`game/server/test/card_windup_resolution.test.js`** (preferred): add `flame_blade` and `soul_drain` describe blocks following the `magma_greatsword applies damage and CARD_USED only after windUpMs` test — seed `player.hand[0]`, place a grunt within attack range, emit `useCard`, assert HP unchanged during wind-up, advance time, call `processPendingCardWindups`, assert HP delta equals card `damage`.
- **`game/server/test/card_windup_lock.test.js`**, **`game/server/test/card_windup_state.test.js`**: grep for `charges: 4` on `magma_greatsword` and `charges: 3` on `flame_blade`; align with sub-ticket 01 values.
- **`game/server/test/integration.test.js`**, **`game/server/test/server.test.js`**: bulk-update hand literals that embed stale `charges` for tuned cards.
- **`game/client/test/main.test.js`**: update `magma_greatsword` wind-up lock fixtures (`charges: 4` → `2`).
- Optional: add `debugScenarios.js` entries only if inline hand setup is awkward; prefer direct `player.hand` seeding like existing wind-up tests.
- Do **not** change JSON stats or client copy in this sub-ticket.

## Verification: code
