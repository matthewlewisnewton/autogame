# Slow status helpers and state (server)

Add the SLOW status-effect foundation to the simulation following the existing
timed-status pattern (`frozenUntil`/`isEnemyFrozen`). Introduce a `slowedUntil`
timestamp plus a `slowFactor` movement multiplier on entities, with
`applySlow(entity, durationMs, factor)` and `isSlowed(entity)` helpers and
re-application/refresh rules. This sub-ticket only adds the status state +
helpers + exports + unit tests; movement integration and the client indicator
are separate sub-tickets.

## Acceptance Criteria
- `applySlow(entity, durationMs, factor)` exists and sets `entity.slowedUntil`
  to `Date.now() + durationMs` and `entity.slowFactor` to the given factor
  (clamped to a sensible range, e.g. `> 0` and `<= 1`; defaults to a sensible
  factor such as `0.5` when omitted).
- `isSlowed(entity)` returns `true` only while `entity.slowedUntil != null` and
  `Date.now() < entity.slowedUntil`, and `false` after expiry or when never
  applied (mirrors `isEnemyFrozen` semantics).
- Re-application REFRESHES the effect: calling `applySlow` again extends
  `slowedUntil` to the later of the current and new expiry (does not stack
  additively or accumulate beyond a single window). The active `slowFactor`
  reflects the most recent application.
- Both helpers are exported from `game/server/simulation.js`.
- Helpers work identically for a player entity and an enemy entity (they operate
  on a generic entity object, not a player- or enemy-specific structure).
- New vitest cases cover: apply sets state, `isSlowed` true while active and
  false after expiry, and re-application refreshes the expiry — for a plain
  entity object.

## Technical Specs
- `game/server/simulation.js`:
  - Add `function applySlow(entity, durationMs, factor)` and
    `function isSlowed(entity)` near the existing `isEnemyFrozen`
    (around line 1010). Follow the `frozenUntil`/`isEnemyFrozen` idiom:
    guard against null entity, use `Date.now()`, and use
    `Math.max(entity.slowedUntil || 0, now + durationMs)` for refresh so a
    re-hit never shortens an existing longer slow.
  - Store the chosen factor on `entity.slowFactor` (clamp to `(0, 1]`; default
    `0.5` when `factor` is omitted/invalid).
  - Add `applySlow` and `isSlowed` to the module exports block
    (around lines 2600-2651, near `isEnemyFrozen`).
- Add tests to the existing server test suite (e.g. a new
  `game/server/test/slow_status.test.js`) exercising the helpers directly on a
  plain object.

## Verification: code
