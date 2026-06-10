# 06 — Inferno Pillar production cast passes caster origin Y

`spawnInfernoPillarEffect()` supports `{ originY }`, and tests pass it directly, but the real `inferno_pillar` card branch in `handleUseCard` omits it even though `originY` is already computed for the initial burst. Wire the production cast so lingering DoT spheres center on the caster's world height.

## Acceptance Criteria

- `handleUseCard` `inferno_pillar` branch calls `spawnInfernoPillarEffect(originX, originZ, cardDef, socket.playerId, { originY })` using the same `originY` already passed to `collectRadialHits` for the initial burst.
- A production-path test casts `inferno_pillar` via `handleUseCard` / the card-caster helper (not by calling `spawnInfernoPillarEffect` directly) from an elevated caster, advances one DoT tick, and verifies an in-sphere elevated enemy is damaged while an out-of-sphere target at the same `(x, z)` is not.
- Existing `inferno_pillar` burst and helper-direct DoT tests continue to pass.

## Technical Specs

- `game/server/cardEffects.js`:
  - At the `inferno_pillar` branch (~line 945), add `{ originY }` as the fifth argument to `spawnInfernoPillarEffect`.
- `game/server/test/spherical_aoe_cards.test.js`:
  - Add a test in the `inferno_pillar` describe block that uses `setupCardCaster('inferno_pillar', { y: CASTER_Y })`, calls `caster.cast()`, then triggers `updateAreaEffects()` after `dotIntervalMs` and asserts DoT height inclusion/exclusion through the production card path only.

## Verification: code
