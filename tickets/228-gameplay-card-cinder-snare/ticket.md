# 228-gameplay-card-cinder-snare

## Difficulty: medium

## Goal

New T2 enchantment 'Cinder Snare' (~25 stones): a ground trap that applies a lingering fire DoT instead of one burst — a sustained-AoE sidegrade to spike_trap. Held from the earlier card batch because its defining mechanic needs real trap-trigger wiring (not pure data).

## Acceptance Criteria

- 1. Add cinder_snare to CARD_DEFS + cardDefs.json identity stub (type enchantment, charges 1) and make it obtainable (via the new acquisition mechanism / SHOP_CARD_POOL). 2. Reuse spawnGroundEnchantment (cardEffects.js:809-840) for placement; on trigger spawn an inferno-pillar-style DoT area (damagePerTick ~8, dotTicks 4, radius 2.5) via spawnInfernoPillarEffect rather than a one-shot radial. 3. Test the DoT-on-trigger behavior; vitest green.

## Verification

Reuses spawnGroundEnchantment + the areaEffects DoT pipeline; the only real wiring is the trap trigger calling spawnInfernoPillarEffect. Medium.
