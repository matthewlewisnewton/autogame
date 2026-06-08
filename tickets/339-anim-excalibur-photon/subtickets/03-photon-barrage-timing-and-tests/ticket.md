# Photon barrage timing sync and test coverage

Align Excalibur Photon's client animation timing with the server effect
resolution: `windUpMs` charge telegraph during commit, then a two-swing
`photon_barrage` burst when `cardUsed` arrives. Stagger every per-swing VFX
(trail, ring, decal, burst) at the canonical 80 ms interval so impacts line up
with the server's `swingsPerUse: 2` / `swingCount: 2` payload.

## Acceptance Criteria

- A shared constant `PHOTON_BARRAGE_SWING_DELAY_MS` (value **80**) is defined
  in `game/client/config.js` and imported by `cardRenderers.js`; both
  `renderConeSwings` and `renderExcaliburPhoton` use it instead of a hardcoded
  `80`.
- `renderExcaliburPhoton` honors `data.swingCount` (2 for Excalibur Photon) and
  `data.specialEffect === 'photon_barrage'`: swing 1 fires at **t = 0 ms**, swing
  2 at **t = 80 ms** via `ctx.scheduleAfter`.
- **All** per-swing composed VFX (cone, trail, telegraph ring, impact decal,
  particle burst) are scheduled inside the same per-swing callback so the second
  swing's impact does not fire at t = 0 (fix the current heavy-greatsword
  pattern where impact primitives fire once immediately regardless of stagger).
- No extra client-side wind-up delay is added in the renderer: `cardUsed` already
  fires after the server's `windUpMs` (600 ms) commit; the existing 315 charge
  telegraph in `renderer.js` handles the wind-up phase automatically.
- Tests in `game/client/test/cardRenderers.test.js`:
  - Firing `excalibur_photon` with `{ swingCount: 2, specialEffect: 'photon_barrage' }`
    produces exactly **2** `spawnAttackEffect` calls and `scheduleAfter` delays
    of `[80]` (first swing immediate).
  - Impact primitives (`spawnImpactDecal`, `spawnTelegraphRing`,
    `spawnParticleBurst`) are also scheduled per swing (e.g. second swing's
    impact is behind a `scheduleAfter(80, …)` call, not emitted synchronously at
    t = 0 only).
  - The existing `staggers photon_barrage swings via scheduleAfter` test still
    passes (now using the shared constant).
- Update the heavy-greatsword test group so `excalibur_photon` is no longer
  tested alongside `steel_claymore` / `magma_greatsword` (those two stay on
  `renderHeavyGreatsword`); excalibur timing/visual tests live in dedicated
  `excalibur_photon` describe blocks.
- Existing client + server vitest suites still pass; no per-frame allocation
  regressions.

## Technical Specs

- `game/client/config.js`:
  - Export `PHOTON_BARRAGE_SWING_DELAY_MS = 80`.
- `game/client/cardRenderers.js`:
  - Import `PHOTON_BARRAGE_SWING_DELAY_MS` from `./config.js`.
  - Replace hardcoded `80` in `renderConeSwings` and `renderExcaliburPhoton`.
  - Refactor `renderExcaliburPhoton` to loop `swingCount` times, wrapping each
    swing's full VFX bundle (attack + trail + ring + decal + burst) in a
    `scheduleAfter(delayPerSwing * i, () => { … })` callback when
    `specialEffect === 'photon_barrage'`.
  - Read `swingCount` from `data.swingCount || 1` and `specialEffect` from
    `data.specialEffect` (mirrors the `cardUsed` payload from
    `game/server/cardEffects.js`).
- `game/client/test/cardRenderers.test.js`:
  - Add dedicated `excalibur_photon` timing tests as described above.
  - Narrow `the three greatswords use mutually distinct accent colors` (and
    sibling greatsword-only tests) to `steel_claymore` + `magma_greatsword`
    only; move excalibur assertions to the photon-specific tests.
  - Optionally assert `CARD_DEFS.excalibur_photon.windUpMs === 600` and
    `swingsPerUse === 2` to document the server timing contract.

## Verification: code
