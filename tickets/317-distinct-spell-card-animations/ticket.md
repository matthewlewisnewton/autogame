# 317-distinct-spell-card-animations

## Difficulty: medium

## Goal

Per-card SPELL animations (polish). Several spells share renderGenericSpellBurst. Give each spell a distinct cast + projectile + impact using 315 primitives (build on the existing custom ones: fireball, ice_ball, chain_lightning, frost_nova/glacier_collapse, phase_beam, event_horizon, inferno_pillar, gravity_well, purifying_pulse). Differentiate by element/theme (fire/ice/lightning/gravity/holy) with distinct projectile trails + impact VFX. DEPENDS ON 315. ACCEPTANCE: each spell reads as visually distinct (cast/projectile/impact); generic-burst spells upgraded; no perf regression; tests where feasible. SCOPE: game/client/cardRenderers.js (spell render fns) + game/client/test.

## Verification

Run the harness checks (vitest server+client) and verify the acceptance criteria above.
