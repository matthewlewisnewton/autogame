# Arcane Bolt animation tests and regression guard

Add focused client tests that lock in Arcane Bolt's visual dispatch, timing constants, and primitive composition so future card-animation passes cannot silently regress this card.

## Acceptance Criteria

- `cardRenderers.test.js` asserts `resolveRenderers('arcane_bolt')` returns exactly one renderer (`renderArcaneBolt`), not `renderWeaponSwing`.
- Updated Arcane Bolt tests verify:
  - `spawnAttackEffect` receives `{ effect: 'arcane_bolt', projectileTravelMs: 600 }` (or `ATTACK_EFFECT_DURATION` constant), `range: 10`, and violet accent colors (`0xa78bfa` / `0x7c3aed`).
  - `spawnProjectileTrail` receives matching `travelMs` and `range`.
  - Terminal `spawnImpactDecal` and arcane `spawnParticleBurst` are scheduled via `scheduleAfter` with delay `600` (not fired synchronously at cast).
  - A cast flourish (`spawnParticleBurst` and/or `spawnTelegraphRing`) fires immediately at the origin.
  - When `data.hits` contains enemy ids present in a stub `enemyMeshes()` map, per-hit pierce bursts fire immediately (synchronous `spawnHitSpark` / `spawnParticleBurst` calls).
- A test documents that `CARD_DEFS.arcane_bolt` has **no** positive `windUpMs` (instant cast; 315 charge telegraph correctly absent).
- The existing melee-swing test ("Arcane Bolt thrusts a tight violet energy lance with a beam streak" ~line 779) is replaced or rewritten to assert the new projectile renderer behavior — no `coneAngle` / `WEAPON_SLASH_STYLES` assertions remain for this card.
- The five-energy-blade distinct-accent test (~line 890) still passes for `arcane_bolt` (accent color unchanged).
- `pnpm test:quick` passes with no perf-regression patterns (no new per-frame allocations in test-covered paths).

## Technical Specs

- `game/client/test/cardRenderers.test.js`:
  - Extend `makeCtx` if needed so `scheduleAfter` records both delay and whether the callback was invoked (existing pattern records delay only — add a `runScheduled()` helper or invoke callbacks in tests).
  - Replace/update the arcane_bolt test case (~line 779) and add new cases for cast flourish, deferred terminal impact, per-hit pierce bursts, renderer registration, and `windUpMs` absence.
  - Import `ATTACK_EFFECT_DURATION` from `../config.js` and/or `CARD_DEFS` from `../cards.js` as needed.
- `game/client/test/vfx-primitives.test.js` (optional but recommended): add a smoke test that spawns `{ effect: 'arcane_bolt', range: 10, color: 0xa78bfa, emissive: 0x7c3aed }`, asserts it enters `getActiveEffects()`, and cleans up after `updateAttackEffects()` when past duration.
- Depends on sub-tickets 01 and 02 (tests target the finished renderer + `renderArcaneBolt` behavior).

## Verification: code
