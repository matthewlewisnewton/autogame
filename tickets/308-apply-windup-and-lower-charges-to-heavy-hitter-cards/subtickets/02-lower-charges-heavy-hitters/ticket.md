# 02-lower-charges-heavy-hitters

Reduce the number of charges on the two heaviest-hitting weapon cards: Solar Edge (flame_blade) from 3 → 2, and Corebreaker Greatsword (magma_greatsword) from 4 → 3. Lower charges complement the wind-up commitment — fewer uses per draw forces more deliberate play.

## Acceptance Criteria

- `game/shared/cardDefs.json` has `"charges": 2` for `flame_blade` (was 3)
- `game/shared/cardDefs.json` has `"charges": 3` for `magma_greatsword` (was 4)
- `game/client/test/cards.test.js` updated to assert new charge values for both cards
- All test fixtures that hardcode `charges: 3` for `flame_blade` or `charges: 4` for `magma_greatsword` are updated to reflect new values (or are confirmed to be independent mock data not asserting card-def correctness)
- All existing tests still pass (`pnpm test`)

## Technical Specs

- **game/shared/cardDefs.json** — change `"charges": 3` → `"charges": 2` on `flame_blade`; change `"charges": 4` → `"charges": 3` on `magma_greatsword`
- **game/client/test/cards.test.js** — update the `flame_blade` test (line 30) to assert `charges: 2`; update the `magma_greatsword` test (line 39) to assert `charges: 3`
- **game/client/test/main.test.js** — update mock hand objects at lines 1025, 1135, 1164, 2004, 2055 (flame_blade charges 3→2); lines 2233, 2255, 2321 (magma_greatsword charges 4→3)
- **game/server/test/server.test.js** — update mock hand objects at lines 1634, 1849, 4779, 4822, 5084 (flame_blade charges 3→2)
- **game/server/test/integration.test.js** — update mock hand objects at lines 1142, 1174 (flame_blade charges 3→2)

## Verification: code
