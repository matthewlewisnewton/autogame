# 01-status-application-vfx

Add distinct VFX at the moment status effects are applied by attack cards, so the player can see slow and burn land on targets. Currently the ongoing slow ring and burn flames exist, but the application instant lacks a visual cue — the ice_ball and fireball hit look the same as a plain damage hit.

## Acceptance Criteria

- **ice_ball slow application**: When ice_ball hits an enemy and applies slow, spawn a freeze-crystal particle burst at the hit position using `spawnParticleBurst()` with icy palette (cyan/snow colors), plus a small `spawnImpactDecal()` at the impact point
- **fireball burn application**: When fireball hits an enemy and applies burn, spawn an ember shower at the hit position using `spawnParticleBurst()` with warm fire palette (orange/amber), plus a `spawnImpactDecal()` scorch mark
- Both effects compose with existing projectile visuals (ice_ball sphere, fireball trail) — no regression to existing attack VFX
- Effects are registered in `CARD_RENDERERS` via upgrades to `renderIceBall` and `renderFireball`
- No new persistent meshes — all effects are transient and cleaned up by `updateAttackEffects()`

## Technical Specs

- **`game/client/cardRenderers.js`**: Upgrade `renderIceBall()` to append a particle burst + impact decal at the projectile's impact point (computed via `pointAlong(origin, direction, data.attackRange)`). Upgrade `renderFireball()` similarly — fireball already has a particle burst + decal, but increase `count` and adjust colors to read as "burn application" rather than generic impact.
- **`game/client/test/cardRenderers.test.js`**: Add tests verifying `renderIceBall` and `renderFireball` call `spawnParticleBurst` and `spawnImpactDecal` with expected style parameters.

## Verification: code
