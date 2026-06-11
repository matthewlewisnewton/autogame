# Gravity Well — animation test coverage

Extend client tests to lock down the polished Gravity Well renderer and timing contract from sub-tickets 01–02. This ticket is test-only: no production code changes unless a minimal test-harness fix is required to unblock a genuine assertion failure.

## Acceptance Criteria

- `game/client/test/cardRenderers.test.js` replaces the existing basic `gravity_well` tests (~L1560–1597) with coverage that asserts:
  - (a) `resolveRenderers('gravity_well')` still resolves to exactly one renderer.
  - (b) `renderGravityWell` invokes `spawnGravityWellEffect` at `data.radius` (12 in fixture) with the purple accent palette (`0xc084fc` / `0xa855f7`).
  - (c) The renderer does **not** invoke `spawnTelegraphRing` as its primary pull effect (outward expand is wrong for gravity pull).
  - (d) `spawnImpactDecal` fires synchronously at the cast origin (same `renderCardUsed` call stack — no deferred scheduling for the primary impact).
  - (e) When `data.pulled` is `[{ enemyId: 'e1' }, { enemyId: 'e2' }]` and `ctx.enemyMeshes()` returns meshes for both ids, `spawnLightningArc` (or equivalent inward streak helper) is called twice with the enemy position as `from` and cast origin as `to`.
  - (f) When `data.pulled` is `[]` or absent, no per-enemy arc calls fire.
  - (g) `CARD_DEFS.gravity_well` has no positive `windUpMs` (instant cast; no charge telegraph).
  - (h) Radius-absent payload skips all VFX (existing guard preserved).
  - (i) Renderer still does not throw when `spawnGravityWellEffect` is absent from ctx (optional-helper guard).
- `event_horizon` tests remain unchanged and passing — Gravity Well polish must not regress Event Horizon's distinct outer/inner mix.
- `pnpm test:quick` passes (full client + server vitest suite).

## Technical Specs

- **`game/client/test/cardRenderers.test.js`**:
  - Update `makeCtx` usage in the `gravity_well` describe block to record `spawnGravityWellEffect` (add to default `makeCtx` record list if not already present after sub-ticket 01 wiring).
  - Replace assertions that expect `spawnTelegraphRing` + outward `spawnParticleBurst` as the primary effect with `spawnGravityWellEffect` + synchronous impact + per-pulled arc assertions.
  - Add `enemyMeshes` mock returning `{ e1: { position: { x: 5, y: 0.6, z: 0 } }, e2: { position: { x: -3, y: 0.6, z: 2 } } }` for the multi-pull case.
  - Import/reference `CARD_DEFS` or `getCardDef` for the `windUpMs` assertion (mirror `fireball` / `dragons_breath` instant-cast tests).
- Do **not** weaken assertions on other cards; do **not** modify `renderer.js` or `cardRenderers.js` unless a test reveals a real bug in sub-ticket 02 output.

## Verification: code
