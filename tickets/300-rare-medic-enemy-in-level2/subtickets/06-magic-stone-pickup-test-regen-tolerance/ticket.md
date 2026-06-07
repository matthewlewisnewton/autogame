# Magic-stone pickup integration test — tolerate passive regen

The `enemy death spawns magic_stone and currency loot entries any player can reach` integration test fails in coverage because passive Magic Stone regen (`MAGIC_STONES_REGEN_PER_TICK = 0.005`) ticks during the `await sleep(10)` after `lootPickup`, making `toBeCloseTo(msBeforePickup + drop.value, 5)` overshoot by 0.005. Adjust the assertion so the test still proves pickup worked without being flaky on regen.

## Acceptance Criteria

- `game/server/test/integration.test.js` test **"enemy death spawns magic_stone and currency loot entries any player can reach"** passes under the full vitest/coverage run (`pnpm test` from `game/`).
- After `lootPickup` on a `magic_stone` drop, the test still asserts:
  - the loot entry is **removed** from `state.loot`;
  - `p2.magicStones` increased by **at least** `drop.value` relative to `msBeforePickup`;
  - the gain is **not wildly above** pickup + a small regen cushion (e.g. upper bound of `drop.value + MAGIC_STONES_REGEN_PER_TICK * N` for ticks during the sleep, or an equivalent tight bound used elsewhere in this file — see Ether Scythe MS test ~L1183–1184 and suspend/resume regen note ~L5416).
- The currency pickup assertion in the same test remains unchanged and passing.
- No production/server gameplay logic changes — test-only fix unless a one-line import of `MAGIC_STONES_REGEN_PER_TICK` from `config.js` is needed for the bound.

## Technical Specs

- `game/server/test/integration.test.js`:
  - In describe block `magic stone drops — any player can pick up`, test `enemy death spawns magic_stone and currency loot entries any player can reach` (~L3923–3964): replace the strict `toBeCloseTo(msBeforePickup + drop.value, 5)` with assertions that confirm pickup value **and** tolerate passive regen during `sleep(10)` — e.g. `toBeGreaterThanOrEqual(msBeforePickup + drop.value)` plus `toBeLessThanOrEqual(msBeforePickup + drop.value + <regen slack>)`, while keeping `expect(state.loot.find((l) => l.id === drop.id)).toBeUndefined()`.
  - Import `MAGIC_STONES_REGEN_PER_TICK` from `../config.js` if used to compute the slack constant.

## Verification: code
