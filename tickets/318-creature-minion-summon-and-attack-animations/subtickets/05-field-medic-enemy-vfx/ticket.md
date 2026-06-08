# Field Medic enemy heal and energy-bead VFX

The rare `field_medic` enemy emits `medicAllyHeal` and `medicBead` socket events handled in `main.js` → `triggerMedicAllyHealVFX` / `triggerMedicEnergyBeadVFX` in `renderer.js`. Upgrade both paths to use the 315 shared primitives so ally heals and offensive energy beads read distinctly from generic heals and player phase beams.

## Acceptance Criteria

- `triggerMedicAllyHealVFX` composes `spawnTelegraphRing` (mint/green, expanding to `healRadius`) plus `spawnParticleBurst` at the medic position; may wrap or replace the bespoke `requestAnimationFrame` ring in `triggerHealPulseVFX` but must not leak meshes (cleanup via `updateAttackEffects` pool).
- `triggerMedicEnergyBeadVFX` adds `spawnProjectileTrail` along the bead vector and `spawnImpactDecal` / `spawnParticleBurst` at the beam end; retains the narrow `returning_projectile` corridor from `spawnAttackEffect`.
- Medic ally heal and bead VFX use `MEDIC_BEAD_COLOR` / teal palette consistently and are visually distinct from `null_crawler` cyan beams (different emissive intensity or ring style).
- `game/client/test/renderer-registry-normalize.test.js` (or a new `field-medic-vfx.test.js`) asserts heal spawns telegraph/burst primitives and bead spawns trail + corridor effect entries in `getActiveEffects()`.
- No perf regression: medic events are infrequent; do not add per-frame work outside existing `updateAttackEffects`.

## Technical Specs

- `game/client/renderer.js`: refactor `triggerHealPulseVFX`, `triggerMedicAllyHealVFX`, and `triggerMedicEnergyBeadVFX` (~lines 2578–2677) to call `spawnTelegraphRing`, `spawnParticleBurst`, `spawnProjectileTrail`, and `spawnImpactDecal`.
- `game/client/main.js`: no handler signature changes expected; verify `MEDIC_ALLY_HEAL` / `MEDIC_BEAD` listeners still call the updated helpers.
- `game/client/test/renderer-registry-normalize.test.js` or new test file: primitive spawn and cleanup assertions using `initScene` + `getActiveEffects` pattern from `vfx-primitives.test.js`.

## Verification: code
