# 03 — Wire caster origin Y into all radial effect call sites

Pass the casting player's resolved world Y into every player-initiated radial helper so spheres are centered on the caster's height, not the floor directly beneath them. Depends on sub-tickets 01 and 02.

## Acceptance Criteria

- `game/server/cardEffects.js` `handleUseCard` passes `originY: getEntityWorldY(player)` (or equivalent) into every call to `collectRadialHits`, `healPlayersInRadius`, `applyFreezeInRadius`, `pullEnemiesToward`, and `applyEventHorizon` — including frost_nova, glacier_collapse, purifying_pulse, gravity_well, event_horizon, inferno_pillar, mana_leach, soul_drain, echo_blade shockwave, creature summon radial bursts, and any other `collectRadialHits` call in this file.
- `game/server/keyItemEffects.js` `field_medic_kit` heal loop uses 3D distance from `(casterX, getEntityWorldY(player), casterZ)` instead of `Math.hypot(dx, dz)`.
- No radial helper call site under `game/server/` left using only XZ distance for inclusion (grep for `Math.hypot(.*dz)` in radius/AoE paths should only remain for horizontal movement, cone facing, or non-radius logic).
- Existing flat-ground card and key-item tests continue to pass.

## Technical Specs

- `game/server/cardEffects.js`: add `originY: getEntityWorldY(player)` to radial helper `options` (or new parameter where the helper signature uses a positional arg) at every radial call site in the spell/weapon/creature branches.
- `game/server/keyItemEffects.js`: import/use `getEntityWorldY` for `field_medic_kit` ally heal radius.
- `game/server/index.js`: only if needed to re-export or thread `getEntityWorldY` to `keyItemEffects.js` (prefer importing from simulation exports already used elsewhere).

## Verification: code
