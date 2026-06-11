# Wyrmflare animation tests and regression guard

Add focused client tests that lock in Wyrmflare's primitive dispatch, server-synced timing constants, DoT tick scheduling, and 315-primitive composition so future card-animation passes cannot silently regress this card. Depends on sub-tickets 01 and 02.

## Acceptance Criteria

- `cardRenderers.test.js` asserts `resolveRenderers('dragons_breath')` returns exactly one renderer (`renderDragonsBreath`).
- Updated `dragons_breath` render tests verify:
  - `spawnDragonsBreathEffect` is called with `(origin, direction, style)` where `style.duration === 2250`, `style.dotTicks === 4`, `style.dotIntervalMs === 500`, `style.range === 7`, `style.coneAngle === Math.PI / 3`, and fire accent colors (`0xfb923c` / `0xff3b00` emissive).
  - `spawnAttackEffect`, `spawnParticleBurst`, and `spawnImpactDecal` fire **synchronously** at cast for the initial cone burst (not deferred).
  - Renderer does **not** call `spawnProjectileTrail` (no server travel phase).
  - When `data.hits` contains enemy ids present in a stub `enemyMeshes()` map, per-hit ignite bursts fire immediately (`spawnHitSpark` and/or `spawnParticleBurst`).
  - `scheduleAfter` is called four times with delays `500`, `1000`, `1500`, `2000` for DoT tick pulses (default `dotTicks`/`dotIntervalMs`).
  - Renderer still does **not** call `spawnSummonEffect` (no generic accent summon ring).
- A test documents that `CARD_DEFS.dragons_breath` has **no** positive `windUpMs` (instant cast; 315 charge telegraph correctly absent).
- Existing graceful-degradation test (optional primitives absent) is updated to match the new composition without weakening coverage.
- `pnpm test:quick` passes with no perf-regression patterns (no new per-frame allocations in test-covered paths).

## Technical Specs

- **`game/client/test/cardRenderers.test.js`**:
  - Extend `makeCtx` to record `spawnDragonsBreathEffect` if not already present (mirror `spawnInfernoPillarEffect` pattern).
  - Update `dragons_breath` test cases (~L1709–1757) and add cases for style-object dispatch, synchronous burst primitives, per-hit sparks, deferred tick pulses, absence of `spawnProjectileTrail`, and `windUpMs` absence.
  - Import `CARD_DEFS` from `../cards.js` as needed.
- **`game/client/test/vfx-primitives.test.js`**: sub-ticket 01 owns primitive-level tests; this ticket only extends `cardRenderers.test.js` unless a gap remains after 01 lands.
- Depends on sub-tickets 01 and 02.

## Verification: code
