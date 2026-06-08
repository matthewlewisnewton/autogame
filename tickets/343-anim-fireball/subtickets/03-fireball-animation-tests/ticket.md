# Fireball animation tests and regression guard

Add focused client tests that lock in Fireball's visual dispatch, timing constants, and primitive composition so future card-animation passes cannot silently regress this card.

## Acceptance Criteria

- `cardRenderers.test.js` asserts `resolveRenderers('fireball')` returns exactly one renderer (`renderFireball`).
- Updated `renderFireball` tests verify:
  - `spawnAttackEffect` receives `{ effect: 'fireball', projectileTravelMs: 600 }` (or `ATTACK_EFFECT_DURATION` constant) and fire accent colors (`0xf97316` / `0xff3b00`).
  - `spawnProjectileTrail` receives matching `travelMs` and `range`.
  - Terminal `spawnImpactDecal` and ember `spawnParticleBurst` are scheduled via `scheduleAfter` with delay `600` (not fired synchronously at cast).
  - A cast flourish (`spawnParticleBurst` and/or `spawnTelegraphRing`) fires immediately at the origin.
  - When `data.hits` contains enemy ids present in a stub `enemyMeshes()` map, per-hit ignite bursts fire immediately (synchronous `spawnHitSpark` / `spawnParticleBurst` calls).
- A test documents that `CARD_DEFS.fireball` has **no** positive `windUpMs` (instant cast; 315 charge telegraph correctly absent).
- Existing fireball tests (`spawns a single fireball-effect projectile`, graceful degradation without optional primitives) are updated to match the new timing/composition without weakening coverage.
- `pnpm test:quick` passes with no perf-regression patterns (no new per-frame allocations in test-covered paths).

## Technical Specs

- `game/client/test/cardRenderers.test.js`:
  - Extend `makeCtx` if needed so `scheduleAfter` records both delay and whether the callback was invoked (existing pattern records delay only — add a `runScheduled()` helper or invoke callbacks in tests).
  - Update fireball test cases (~lines 427–484) and add new cases for cast flourish, deferred terminal impact, per-hit ignition, and `windUpMs` absence.
  - Import `ATTACK_EFFECT_DURATION` from `../config.js` and/or `CARD_DEFS` from `../cards.js` as needed.
- Depends on sub-tickets 01 and 02 (tests target the finished renderer + `renderFireball` behavior).

## Verification: code
