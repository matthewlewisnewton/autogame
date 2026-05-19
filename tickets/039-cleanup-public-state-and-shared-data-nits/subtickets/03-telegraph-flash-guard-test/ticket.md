# Avoid per-frame telegraph flash resets — verify guard and add test

The original nit flagged that enemy wind-up rendering calls `flashMesh` every animation frame during wind-up. The current code uses `applyWindupFlash()` with a `windupFlashing` Set guard, which prevents re-flashing the same enemy mid-wind-up. Verify this guard is correct and add a unit test to prevent regression.

## Acceptance Criteria

- Enemy wind-up visuals do not start a new flash timer every animation frame for the same enemy.
- A unit test confirms that calling `applyWindupFlash(enemyId, true)` multiple times in a row only sets emissive once (the `windupFlashing` Set guards against duplicates).
- Calling `applyWindupFlash(enemyId, false)` after a wind-up restore clears the emissive and removes the Set entry.
- Existing enemy hit flash behavior (separate `flashMesh` calls on damage) still works.

## Technical Specs

- **File**: `game/client/main.js` — `applyWindupFlash()` (line ~759), `windupFlashing` Set (line ~141), wind-up rendering block (line ~1539).
- **File**: `game/client/test/main.test.js` — add unit tests for `applyWindupFlash` idempotency: call with `true` twice, verify emissive set only once; call with `false`, verify emissive cleared and Set entry removed.

## Verification: code
