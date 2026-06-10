# Set sane default attackIntervalMs for astral_guardian / aegis_sentinel minions

`astral_guardian` and `aegis_sentinel` minions default `attackIntervalMs` to `Math.floor(1000 / TICK_RATE)` (one tick ≈ 50 ms) in `applyAstralShieldCast()` (`game/server/cardEffects.js` ~line 240) because neither card definition in `cardStats.json` specifies `attackIntervalMs`. As a result they attack every tick (~11 dmg × 20/s ≈ 220 DPS). Fix by adding `attackIntervalMs` to both card definitions and raising the fallback default in the guardian branch of `updateMinions()`.

## Acceptance Criteria

- `astral_guardian` and `aegis_sentinel` entries in `cardStats.json` define `attackIntervalMs` (1500 ms)
- The guardian branch in `updateMinions()` (`simulation.js` ~line 3200) defaults `attackIntervalMs` to 1500 ms instead of `Math.floor(1000 / TICK_RATE)` when the minion object lacks the property
- Guardian minions attack at the configured interval (≥ 1000 ms), not every tick
- Existing minion tests still pass; add a test confirming guardian attacks at most once per interval

## Technical Specs

- **`game/shared/cardStats.json`**: Add `"attackIntervalMs": 1500` to both `astral_guardian` and `aegis_sentinel` entries
- **`game/server/simulation.js`** (~line 3200): Change `const attackIntervalMs = minion.attackIntervalMs || Math.floor(1000 / TICK_RATE);` to `const attackIntervalMs = minion.attackIntervalMs || 1500;`
- **`game/server/test/creature_minions.test.js`**: Add test creating an `astral_guardian` minion, calling `updateMinions()` twice within the interval, asserting only one damage event

## Verification: code
