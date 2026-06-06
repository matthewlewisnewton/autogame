# Full vitest green after balance pass

Run the full harness test suite after card-balance tunings land and fix any regressions so the top-level ticket acceptance criterion — applied tunings with passing tests — is satisfied repo-wide.

## Acceptance Criteria

- `cd game && pnpm test:quick` exits 0 (server + client vitest).
- If `pnpm test:quick` passes but `pnpm test` (full coverage run) fails only on pre-existing unrelated flakes, document the failure in `game/validation/card-balance/report.md` under **Test notes** with log excerpt; otherwise fix until `pnpm test` exits 0.
- `game/validation/card-balance/report.md` ends with **Outcome: PASS** once tests are green.
- No new gameplay features or non-balance refactors — fixes limited to test expectations, timing tolerances tied to changed card stats, or revert of a Tier A tuning that breaks an invariant (with report updated to move it to Tier B).

## Technical Specs

- **`game/server/test/`** and **`game/client/test/`**: address failures caused by sub-ticket 03 stat changes (common files: `card_sync.test.js`, `card_acquisition.test.js`, `new_card_pack.test.js`, card effect tests for fireball/ice_ball/chain_lightning/purifying_pulse/dungeon_drake).
- **`game/validation/card-balance/report.md`**: update outcome footer and test notes; no new analysis required.
- Do **not** introduce new card stats or balance changes beyond what sub-ticket 03 already applied.

## Verification: code
