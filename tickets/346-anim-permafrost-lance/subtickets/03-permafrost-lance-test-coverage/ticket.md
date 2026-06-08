# Permafrost Lance animation test coverage

Add and update client Vitest coverage so the polished Permafrost Lance renderer and timing contract are locked in and remain distinct from Cryo Burst. Depends on sub-tickets 01–02.

## Acceptance Criteria

- `game/client/test/cardRenderers.test.js` updates the existing `permafrost_lance` case (~line 967) to assert the full polished call signature:
  - `spawnAttackEffect` with `effect: 'permafrost_lance'` and `range: 6`.
  - `spawnTelegraphRing` with radius ≈ `3.3` (`6 * 0.55`).
  - `spawnProjectileTrail` with `travelMs: 600` (`ATTACK_EFFECT_DURATION`).
  - `spawnImpactDecal` at tip `{ x: 6, z: 0 }` for payload `origin {0,0}`, `direction {1,0}`, `radius 6`.
  - `spawnParticleBurst` at the same tip position.
- A test asserts `permafrost_lance` and `frost_nova` resolve to different renderer functions and produce different helper call signatures for equivalent radial payloads.
- A test asserts `CARD_DEFS.permafrost_lance` (or `getCardDef('permafrost_lance')` if that accessor exists in the test file) has no positive `windUpMs`.
- `game/client/test/vfx-primitives.test.js` from sub-ticket 01 continues to pass.
- `cd game && pnpm test:quick` passes with no regressions in `cardRenderers.test.js` or `vfx-primitives.test.js`.

## Technical Specs

- **`game/client/test/cardRenderers.test.js`**:
  - Extend/replace the `permafrost_lance uses a narrower telegraph…` test to cover `spawnAttackEffect`, `spawnImpactDecal`, and `travelMs: 600` on the trail style object.
  - Import `ATTACK_EFFECT_DURATION` from `../config.js` for the timing assertion constant.
  - Add or extend wind-up absence assertion alongside existing instant-cast spell tests.
- **`game/client/test/vfx-primitives.test.js`**: no further changes expected unless sub-ticket 01 left gaps; fix only if quick suite fails.
- Do **not** modify `cardRenderers.js` or `renderer.js` unless a test reveals a clear bug in sub-tickets 01–02.

## Verification: code
