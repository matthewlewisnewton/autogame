# Solar Edge — animation test coverage & regression guard

Lock in the Solar Edge cast polish and server timing sync from sub-tickets 01–02 with focused client tests and a quick-suite green run. Ensure the generic `renderWeaponSwing` path, sibling blades, and unrelated weapon renderers remain unchanged. Depends on sub-ticket 02.

## Acceptance Criteria

- `resolveRenderers('flame_blade')` returns exactly one renderer function that is **not** `renderWeaponSwing`.
- **Solar theme test**: `renderCardUsed` with `{ cardId: 'flame_blade', origin, direction, hits: [] }` asserts:
  - `spawnAttackEffect` uses the solar palette (gold-white body `0xfef08a` family, orange emissive `0xff7a18` / `0xff3b00` family).
  - `spawnProjectileTrail` is called with the solar palette along the arc.
  - `spawnSolarEdgeImpactFlourish` is called at the strike point.
  - `spawnTelegraphRing` is called at the strike point with the solar corona palette.
- **Server geometry sync test**: payload with `attackConeAngle: Math.PI / 2` and `attackRange: 5` drives the `spawnAttackEffect` cone/range — the renderer honors server fields (replacing the old "ignores payload" behavior).
- **Timing contract test**: asserts `CARD_DEFS.flame_blade.windUpMs === 650` and that a default single-swing cast emits **no** `scheduleAfter` calls (wind-up is server-side; swing is immediate on `CARD_USED`).
- **Per-hit spark test**: payload with `hits: [{ enemyId: 'e1' }]` and a stubbed `enemyMeshes` entry calls `spawnHitSpark` at the enemy mesh position.
- **Palette distinctness**: Solar Edge colors differ from `magma_greatsword` (`renderHeavyGreatsword`), `saber_of_light`, and `iron_sword` in the existing weapon-slash tests.
- **Graceful degradation**: `renderSolarEdge` with `spawnSolarEdgeImpactFlourish: undefined` still calls `spawnAttackEffect` and does not throw.
- **Registry isolation**: existing `iron_sword`, `magma_greatsword`, `saber_of_light`, and `excalibur_photon` renderer tests continue to pass unchanged.
- Update or replace the existing `styled weapon slashes` tests for `flame_blade` (~L861–879 and ~L944–958 in `cardRenderers.test.js`) so they match the new dedicated renderer contract.
- `cd game && pnpm test:quick` passes (server + client vitest).

## Technical Specs

- **`game/client/test/cardRenderers.test.js`**:
  - Add a `describe('renderCardUsed() — Solar Edge (flame_blade)')` block (or extend the weapon-slash section) with theme, geometry-sync, timing, per-hit, distinctness, and degradation tests per Acceptance Criteria.
  - Extend `makeCtx()` to stub `spawnSolarEdgeImpactFlourish` if not already present.
  - Remove or rewrite the test that asserts `flame_blade` **ignores** `attackConeAngle`/`attackRange` — the polish pass intentionally syncs to server geometry.
  - Keep the existing `Solar Edge (flame_blade) carries a positive windUpMs` assertion (may move into the new describe block).
- **`game/client/cardRenderers.js`**, **`renderer.js`**, **`main.js`**: touch only if a test reveals a genuine bug in sub-tickets 01–02 (minimal fix).
- Do **not** weaken assertions on sibling weapon or spell renderer cases.

## Verification: code
