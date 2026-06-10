# Regression test: quest crystals survive past LOOT_LIFETIME_MS

Add a unit test that verifies quest-critical loot (crystals) is not removed by the lifetime filter after `LOOT_LIFETIME_MS` has elapsed, while ordinary loot still expires normally.

## Acceptance Criteria
- A new test exists under `game/server/test/` that:
  - Creates a loot array with both quest-critical (`questCritical: true`) and ordinary entries
  - Advances a simulated clock past `LOOT_LIFETIME_MS` (120000 ms)
  - Applies the same filter logic used in the game loop
  - Asserts quest-critical entries remain, ordinary entries are removed
- The test passes when run via `pnpm test`

## Technical Specs
- **`game/server/test/crystal_lifetime.test.js`** (new file): Test the lifetime filter logic. Import `LOOT_LIFETIME_MS` from `game/server/config.js`. Construct a mock `state.loot` array with `createdAt` timestamps in the past, run the filter, and assert survival of `questCritical` items.

## Verification: code
