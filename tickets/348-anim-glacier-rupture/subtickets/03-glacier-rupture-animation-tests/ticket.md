# Glacier Rupture — animation test coverage

Add and update client Vitest coverage so the polished Glacier Rupture renderer, timing contract, and distinction from Cryo Burst are locked in. Depends on sub-tickets 01–02.

## Acceptance Criteria

- `game/client/test/cardRenderers.test.js` updates the existing `glacier_collapse` cases (~lines 1465–1494) to assert the full polished call signature:
  - `spawnGlacierRuptureEffect` at `origin` with `data.radius` and glacier palette `{ color: 0x38bdf8, emissive: 0x0ea5e9 }`.
  - `spawnTelegraphRing` at full `data.radius` (not the generic summon ring — `spawnSummonEffect` must **not** be called).
  - `spawnImpactDecal` at the cast origin.
  - `spawnParticleBurst` at the cast origin with glacier palette.
  - **No** `setTimeout` / `ctx.scheduleAfter` during the render call (spy or assert synchronous primitive dispatch).
- A test with `hits: [{ enemyId: 'e1' }]` and a fake enemy mesh asserts one per-hit shatter burst (`spawnHitSpark` and/or `spawnParticleBurst`) at the enemy position.
- A test with `hits: [{ enemyId: 'e1', frozenShatter: true }]` asserts a larger shatter burst than a non-shatter hit (higher `count` or `spread` in the burst style).
- A test asserts `glacier_collapse` and `frost_nova` resolve to different renderer functions and produce different helper call signatures for equivalent radial payloads.
- A test asserts `getCardDef('glacier_collapse').windUpMs === 700` (positive — the 307/315 charge telegraph applies during wind-up; the renderer itself fires at instant `CARD_USED`).
- Graceful-degradation test: renderer with `spawnGlacierRuptureEffect: undefined` (and other primitives absent) does not throw.
- `game/client/test/vfx-primitives.test.js` from sub-ticket 01 continues to pass.
- `cd game && pnpm test:quick` passes with no regressions in `cardRenderers.test.js` or `vfx-primitives.test.js`.

## Technical Specs

- **`game/client/test/cardRenderers.test.js`**:
  - Update `makeCtx()` to record `spawnGlacierRuptureEffect` if not already present (~line 36 area alongside other bespoke primitives).
  - Extend/replace the `uses the fixed glacier palette for glacier_collapse` and `glacier_collapse adds a glacier telegraph ring and shatter burst` tests to cover the new primitive, impact decal, synchronous timing, per-hit shatter, and `frozenShatter` scaling.
  - Add frost_nova contrast test (different renderer fn + different call signatures).
  - Add `windUpMs === 700` assertion alongside existing wind-up spell tests.
  - Add no-primitives graceful-degradation case.
- **`game/client/test/vfx-primitives.test.js`**: no further changes expected unless sub-ticket 01 left gaps; fix only if quick suite fails.
- Do **not** modify `cardRenderers.js` or `renderer.js` unless a test reveals a clear bug in sub-tickets 01–02.

## Verification: code
