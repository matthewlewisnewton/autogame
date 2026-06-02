## Remove dead `spire-ascent` LAYOUT_PROFILES entry

`LAYOUT_PROFILES['spire-ascent']` in `game/server/dungeon.js` is never consumed:
`generateLayout` intercepts the `'spire-ascent'` profile and dispatches to
`generateSpireAscent()` before `normalizeLayoutProfile` is ever reached. The
entry is harmless but misleading (it implies the generic cell-based path is used).

### Acceptance Criteria
- The unused `'spire-ascent'` key is removed from `LAYOUT_PROFILES`, or a comment
  makes clear it exists only so the profile name validates, with no behavior change.
- All existing spire-ascent tests still pass.

## Spire total Y-gain sits exactly on the ≥10 bound

`generateSpireAscent` sets `yTop = yBase + minTotalYGain` (exactly 10), so the
spawn→top gain is precisely at the acceptance threshold with zero margin. A small
buffer (e.g. target 11–12) would make the "height is felt" intent more robust
against any future floor-sampling rounding.

### Acceptance Criteria
- Total spawn→top Y gain has a small margin above 10 (or a comment documents the
  deliberate exact-10 choice).
- The Y-gain unit test continues to pass.