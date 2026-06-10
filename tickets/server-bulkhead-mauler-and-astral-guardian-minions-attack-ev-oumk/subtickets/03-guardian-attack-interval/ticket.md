# Fix guardian minion attack interval: astral_guardian and aegis_sentinel attack every tick

Both review gaps reduce to the same root cause: `astral_guardian` and `aegis_sentinel` minions default to `Math.floor(1000 / TICK_RATE)` (~50 ms) for `attackIntervalMs` because `cardStats.json` defines no interval, `CARD_STAT_OVERLAY` explicitly sets one-tick, and both the spawn factory and simulation fallback use the one-tick default. Fix all four definition points so guardian minions attack at >=1000 ms, matching the pattern established by `null_crawler` (2000 ms) and `bulkhead_mauler` (1500 ms).

## Acceptance Criteria

- `cardStats.json` defines `"attackIntervalMs": 1500` for both `astral_guardian` and `aegis_sentinel` entries
- `CARD_STAT_OVERLAY.astral_guardian` in `progression.js` no longer hard-codes a one-tick `attackIntervalMs` (remove the overlay entry entirely since cardStats now carries the field)
- Generic minion spawn in `cardEffects.js` (line ~208) defaults `attackIntervalMs` to **1500 ms** (not `Math.floor(1000 / TICK_RATE)`) when `cardDef.attackIntervalMs` is absent
- Guardian branch in `simulation.js` (line ~2893) falls back to **1500 ms** (not `Math.floor(1000 / TICK_RATE)`) when `minion.attackIntervalMs` is absent
- `astral_guardian.test.js` updated: spawned minion expects `attackIntervalMs: 1500` (not one-tick); the "deals more damage per tick" test rewritten as a double-tick regression test confirming the second `updateMinions()` call within 1500 ms does NOT deal damage
- All existing tests pass (`pnpm test:quick`)

## Technical Specs

- **`game/shared/cardStats.json`** — Add `"attackIntervalMs": 1500` to both the `aegis_sentinel` and `astral_guardian` entries.
- **`game/server/progression.js`** — Delete the `astral_guardian: { attackIntervalMs: Math.floor(1000 / TICK_RATE) }` line from `CARD_STAT_OVERLAY` (line ~202). The overlay is merged on top of cardStats, so removing it lets the cardStats value win.
- **`game/server/cardEffects.js`** — Change line ~208 from `attackIntervalMs: cardDef.attackIntervalMs || Math.floor(1000 / TICK_RATE)` to `attackIntervalMs: cardDef.attackIntervalMs || 1500`.
- **`game/server/simulation.js`** — Change line ~2893 from `minion.attackIntervalMs || Math.floor(1000 / TICK_RATE)` to `minion.attackIntervalMs || 1500`.
- **`game/server/test/astral_guardian.test.js`** — Update the "radial AoE, shield, and astral guardian minion spawn when played" test: change `attackIntervalMs: Math.floor(1000 / TICK_RATE)` to `attackIntervalMs: 1500` in the `toMatchObject` assertion. Rewrite the "deals more damage per tick" test: set `attackIntervalMs: 1500` on the fixture, call `updateMinions()` once (should deal 11 dmg), then advance mock time by <1500 ms and call `updateMinions()` again — verify enemy HP is unchanged. Add a new test: "astral guardian minion does NOT attack again within attackIntervalMs" that explicitly verifies the interval gate.

## Verification: code
