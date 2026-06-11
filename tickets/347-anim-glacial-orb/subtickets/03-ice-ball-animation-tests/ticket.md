# Glacial Orb animation tests and regression guard

Add focused client tests that lock in Glacial Orb's visual dispatch, timing constants, and primitive composition so future card-animation passes cannot silently regress this card. Depends on sub-tickets 01–02.

## Acceptance Criteria

- `cardRenderers.test.js` asserts `resolveRenderers('ice_ball')` returns exactly one renderer (`renderIceBall`).
- Updated `renderIceBall` tests verify:
  - `spawnAttackEffect` receives `{ effect: 'ice_ball', projectileTravelMs: 1200 }` (or the payload's `projectileTravelMs`) and icy accent colors (`0x67e8f9` / `0x38bdf8`).
  - `spawnProjectileTrail` receives matching `travelMs: 1200` and `range: 9`.
  - Terminal `spawnImpactDecal` and freeze-crystal `spawnParticleBurst` are scheduled via `scheduleAfter` with delay `1200` (not fired synchronously at cast).
  - A cast flourish (`spawnParticleBurst` and/or `spawnTelegraphRing`) fires immediately at the origin.
  - When `data.hits` contains enemy ids present in a stub `enemyMeshes()` map, per-hit frost bursts fire immediately (synchronous `spawnHitSpark` / `spawnParticleBurst` calls).
- A test documents that `CARD_DEFS.ice_ball` has **no** positive `windUpMs` (instant cast; 315 charge telegraph correctly absent).
- `game/client/test/vfx-primitives.test.js` adds a smoke test that spawns the upgraded `ice_ball` attack effect, asserts it enters `getActiveEffects()` with a glacial-orb marker (e.g. `isGlacialOrbProjectile`), and cleans up after `updateAttackEffects()` when past duration.
- Existing ice_ball tests (`spawns a single ice_ball-effect projectile`, `adds a projectile trail…`, graceful degradation without optional primitives) are updated to match the new timing/composition without weakening coverage.
- `cd game && pnpm test:quick` passes with no regressions in `cardRenderers.test.js` or `vfx-primitives.test.js`.

## Technical Specs

- `game/client/test/cardRenderers.test.js`:
  - Extend `makeCtx` if needed so `scheduleAfter` records both delay and whether the callback was invoked (existing pattern records delay only — add a `runScheduled()` helper or invoke callbacks in tests).
  - Update ice_ball test cases (~lines 580–642) and add new cases for cast flourish, deferred terminal impact, per-hit frost bursts, and `windUpMs` absence.
  - Import `CARD_DEFS` from `../cards.js` as needed for the wind-up assertion.
- `game/client/test/vfx-primitives.test.js`:
  - Add spawn/cleanup test for `spawnAttackEffect` with `{ effect: 'ice_ball', range: 9, projectileTravelMs: 1200, color: 0x67e8f9, emissive: 0x38bdf8 }`.
- Do **not** modify `cardRenderers.js` or `renderer.js` unless a test reveals a clear bug in sub-tickets 01–02.

## Verification: code
