# Stabilize field medic kit out-of-range MS assertion

The `out-of-range player unchanged` test in `field_medic_kit.test.js` flakes under parallel Vitest because MS regen ticks add ~0.005 stones while the kit resolves, and `toBeCloseTo(p3MsBefore, 2)` rejects a difference of exactly 0.005. Adjust the assertion so the test tolerates benign fractional MS drift without weakening the “out-of-range player not healed” intent.

## Acceptance Criteria

- `server/test/field_medic_kit.test.js > useKeyItem — field_medic_kit > out-of-range player unchanged` passes reliably when run as part of the full parallel server suite (`pnpm test` from `game/`).
- The test still asserts p3 HP is unchanged exactly (`50`).
- The test still asserts p3 MS did not receive the +3 kit restore (remains near the pre-cast baseline, not bumped to ~13).
- No change to field medic kit gameplay logic — test-only fix.

## Technical Specs

- `game/server/test/field_medic_kit.test.js` — in the `out-of-range player unchanged` case, relax the MS check to account for regen tick noise: e.g. `toBeCloseTo(p3MsBefore, 1)` (allows ±0.05), or assert `magicStones` is `< p3MsBefore + 1` and `>= p3MsBefore` so a +3 heal would still fail. Prefer the smallest change that eliminates the 0.005 boundary flake documented in `round-1/coverage.log`.

## Verification: code
