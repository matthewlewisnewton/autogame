1. `dragons_breath` lingering DoT ticks are still not fully 3D: the card cast uses tilted aim for the initial burst, but `spawnDragonsBreathEffect()` stores no `originY`/`dirY` and `updateAreaEffects()` calls `collectConeHits()` without vertical options.
   Files: `game/server/cardEffects.js`, `game/server/simulation.js`, `game/server/test/spherical_aoe_cards.test.js`
   Fix: Thread the caster `originY` and `dirY` into the spawned `dragons_breath` area effect, use them during `updateAreaEffects()`, and add height tests for the lingering tick hitting in-sphere elevated targets and excluding vertically out-of-sphere targets.

2. `inferno_pillar` production casts lose the caster world Y for lingering ticks: tests call `spawnInfernoPillarEffect()` with `{ originY }`, but `handleUseCard` calls it without the already computed caster `originY`.
   Files: `game/server/cardEffects.js`, `game/server/simulation.js`, `game/server/test/spherical_aoe_cards.test.js`
   Fix: Pass `{ originY }` from the real `inferno_pillar` card branch into `spawnInfernoPillarEffect()`, and add a production-path test that casts the card from an elevated caster and verifies the DoT sphere is centered at that caster height.

3. Several remaining gameplay radius filters are still XZ-only, so the ticket does not satisfy "ALL AoE/radius effects" or enemy/player symmetry.
   Files: `game/server/keyItemEffects.js`, `game/server/simulation.js`, `game/server/index.js`, `game/server/test/spherical_aoe.test.js`, `game/server/test/spherical_aoe_cards.test.js`
   Fix: Audit combat/effect `Math.hypot(dx, dz)` radius checks and convert them to 3D where they affect gameplay radii, including `rally_cry`, `flare_beacon`, smoke concealment, enemy field-medic healing, sacrifice target radius, and flat-aim `chain_lightning` chain radius; add in-sphere/out-of-sphere height tests for each converted path.
