# Burning status helpers and state (server)

Add the BURNING (damage-over-time) status-effect foundation to the simulation,
following the existing timed-status pattern (`frozenUntil`/`isEnemyFrozen`,
`slowedUntil`/`isSlowed`). Introduce a `burningUntil` timestamp on entities with
`applyBurning(entity, durationMs)` and `isBurning(entity)` helpers plus
re-application/refresh rules. This sub-ticket only adds the status state +
helpers + exports + unit tests; the per-tick damage and the client flame
animation are separate sub-tickets.

## Acceptance Criteria
- `applyBurning(entity, durationMs)` exists and sets `entity.burningUntil` to
  the later of its current value and `Date.now() + durationMs` (re-application
  REFRESHES / extends, never shortens an existing longer burn — no additive
  stacking). It guards against a null/undefined entity.
- `isBurning(entity)` returns `true` only while `entity.burningUntil != null`
  and `Date.now() < entity.burningUntil`, and `false` after expiry or when
  never applied (mirrors `isEnemyFrozen`/`isSlowed` semantics, including a null
  entity returning `false`).
- Both helpers operate on a generic entity object and work identically for a
  player entity and an enemy entity (no player- or enemy-specific structure).
- Both helpers are exported from `game/server/simulation.js`.
- New vitest cases (on a plain entity object) cover: apply sets
  `burningUntil`; `isBurning` is `true` while active and `false` after expiry;
  re-application extends the expiry to the later timestamp and never shortens an
  existing longer burn; `isBurning(null)` is `false`.

## Technical Specs
- `game/server/simulation.js`:
  - Add `function applyBurning(entity, durationMs)` and
    `function isBurning(entity)` next to the existing `applySlow`/`isSlowed`
    (around lines 1016-1032). Follow the established idiom: guard null entity,
    use `Date.now()`, and `entity.burningUntil = Math.max(entity.burningUntil || 0, now + durationMs)`
    for refresh.
  - Add `applyBurning` and `isBurning` to the module exports block
    (around line 2582, near `applySlow`/`isSlowed`/`isEnemyFrozen`).
- Add tests in a new `game/server/test/burning_status.test.js` exercising the
  helpers directly on a plain object (mirror `slow_status.test.js`).

## Verification: code
