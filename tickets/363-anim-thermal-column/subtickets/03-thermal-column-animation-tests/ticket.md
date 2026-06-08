# Thermal Column animation tests and regression guard

Add focused client tests that lock in Thermal Column's primitive dispatch, server-synced timing constants, DoT tick scheduling, and 315-primitive composition so future card-animation passes cannot silently regress this card. Depends on sub-tickets 01 and 02.

## Acceptance Criteria

- `cardRenderers.test.js` asserts `resolveRenderers('inferno_pillar')` returns exactly one renderer (`renderInfernoPillar`).
- Updated `inferno_pillar` render tests verify:
  - `spawnInfernoPillarEffect` is called with `(origin, radius, style)` where `style.duration === 2250`, `style.dotTicks === 4`, `style.dotIntervalMs === 500`, and fire accent colors (`0xef4444` / `0xff3b00` emissive).
  - `spawnTelegraphRing`, `spawnParticleBurst`, and `spawnImpactDecal` fire **synchronously** at cast (not deferred).
  - When `data.hits` contains enemy ids present in a stub `enemyMeshes()` map, per-hit ignite bursts fire immediately (`spawnHitSpark` and/or `spawnParticleBurst`).
  - `scheduleAfter` is called four times with delays `500`, `1000`, `1500`, `2000` for DoT tick pulses (default `dotTicks`/`dotIntervalMs`).
  - Renderer still does **not** call `spawnSummonEffect` (no generic accent summon ring).
- A test documents that `CARD_DEFS.inferno_pillar` has **no** positive `windUpMs` (instant cast; 315 charge telegraph correctly absent).
- Existing graceful-degradation test (optional primitives absent) is updated to match the new composition without weakening coverage.
- `pnpm test:quick` passes with no perf-regression patterns (no new per-frame allocations in test-covered paths).

## Technical Specs

- **`game/client/test/cardRenderers.test.js`**:
  - Extend `makeCtx` if needed so `scheduleAfter` records delay values (existing pattern may only record delay — ensure tick delays are assertable, e.g. collect all `scheduleAfter` delays in `_calls`).
  - Update `inferno_pillar` test cases (~L1565–1606) and add cases for style-object dispatch, synchronous eruption primitives, per-hit sparks, deferred tick pulses, and `windUpMs` absence.
  - Import `CARD_DEFS` from `../cards.js` as needed.
- **`game/client/test/vfx-primitives.test.js`**: sub-ticket 01 owns primitive-level tests; this ticket only extends `cardRenderers.test.js` unless a gap remains after 01 lands.
- Depends on sub-tickets 01 and 02.

## Verification: code
