# Upgrade exemplar cards to use the new VFX primitives

With the shared primitives available on the ctx (sub-ticket 01), upgrade 2–3
exemplar card renderers in `cardRenderers.js` to compose the new primitives —
serving as a reference pattern for the later per-category passes (316–319).
Each upgraded card pulls its tint from `getAccentHex` so the new visuals are
accent-themed.

## Acceptance Criteria
- At least 2 (preferably 3) exemplar card renderers in
  `game/client/cardRenderers.js` are upgraded to call the new ctx primitives
  (`spawnProjectileTrail`, `spawnParticleBurst`, `spawnImpactDecal`, and/or
  `spawnTelegraphRing`) in addition to their existing visuals. Suggested set:
  - `fireball` (`renderFireball`): add a `spawnProjectileTrail` along the cast
    direction and a `spawnImpactDecal`/`spawnParticleBurst` flourish.
  - one AoE/impact spell (e.g. `inferno_pillar` or `glacier_collapse`): add a
    `spawnTelegraphRing` and/or `spawnParticleBurst` at the impact origin.
  - one more renderer of the implementer's choice (e.g. a melee weapon hit
    using `spawnParticleBurst`).
- Each upgraded renderer derives its `color`/`emissive` from
  `getAccentHex(data.cardId)` with a sensible fallback, so the new primitives
  are consistently accent-themed.
- Upgraded renderers degrade safely when a new ctx helper is absent (guard with
  `if (ctx.spawnProjectileTrail)` etc.) so old/partial ctx objects don't throw.
- No regression to the existing visuals: the previously-asserted helper calls
  for each upgraded card still fire (existing `cardRenderers.test.js` cases
  continue to pass).
- Vitest tests in `cardRenderers.test.js` assert each upgraded renderer now
  invokes its new primitive(s) with the expected accent-derived style, using
  the existing `makeCtx` call-recording pattern (extend `makeCtx` to record the
  new helpers).

## Technical Specs
- `game/client/cardRenderers.js`: modify the chosen renderer functions
  (e.g. `renderFireball` ~line 248, `renderInfernoPillar` ~line 154 /
  `renderGlacierCollapse` ~line 114, plus one melee/hit renderer). Reuse the
  existing `getAccentHex` and `accentSummonStyle` helpers for theming. Do not
  change the registry wiring beyond what the upgrades require.
- `game/client/test/cardRenderers.test.js`: add `spawnParticleBurst`,
  `spawnProjectileTrail`, `spawnImpactDecal`, `spawnTelegraphRing` to the
  recorded helpers in `makeCtx` (~lines 13–38) and add assertions for the
  upgraded renderers.
- Depends on sub-ticket 01 (the ctx must expose the new primitives).

## Verification: code
