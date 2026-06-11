# Migrate column and specialized ring effect updaters

## Description

After the scaffold (sub-ticket 01) and radius fix (02), move the remaining single-mesh column risers and specialized ground-ring updaters out of the flag chain into the registry. These effects already have explicit boolean flags but duplicate the same elapsed/t/dispose boilerplate.

## Acceptance Criteria

- Registry entries exist for: `lightColumn`, `thermalColumn`, `etherSiphonColumn`, `legionMarshalColumn`, `batteryAutomatonColumn`, `chronoTriggerColumn`, `etherSiphonRing`, `batteryAutomatonRing`, `chronoTriggerRipple`, `glacierRuptureRing`, `spikeTrapSpike`
- Corresponding spawners set `kind` on push (flags may remain for transition): `spawnDivineGraceColumn`, `spawnRestorationBeaconColumn`, `spawnCleanseBurstEffect`, `spawnTelepipeCastEffect` (column), `spawnThermalColumn`, `spawnEtherSiphonRing` / `spawnEtherSiphonColumn`, `spawnLegionMarshalRallyEffect` (column), `spawnBatteryAutomatonDeployEffect`, `spawnBatteryChargePulseEffect`, `spawnChronoTriggerRipple`, `spawnChronoTriggerColumn`, `spawnGlacierRuptureRing`, `spawnSpikeTrapEffect` (spikes)
- Column updaters preserve base-pinning (`position.y` tracks `scale.y`), per-effect overrides (`columnHeight`, `columnBaseY`, `columnOpacity`), and emissive flicker constants
- Specialized rings preserve contract/pulse behavior (`ETHER_SIPHON_RING_CONTRACT_MIN`, chrono tick pulse, glacier fracture pulse, battery flicker)
- `pnpm test` passes for ether siphon, battery automaton, chrono trigger, glacier rupture ring, divine grace / restoration beacon columns, thermal column, spike trap spikes

## Technical Specs

- **`game/client/renderer/attackEffectUpdaters.js`**
  - Extract and register updaters from `updateAttackEffects` branches: `isLightColumn`, `isThermalColumn`, `isEtherSiphonColumn`, `isLegionMarshalColumn`, `isBatteryAutomatonColumn`, `isChronoTriggerColumn`, `isEtherSiphonRing`, `isBatteryAutomatonRing`, `isChronoTriggerRipple`, `isGlacierRuptureRing`, `isSpikeTrapSpike`
- **`game/client/renderer.js`**
  - Set `kind` on each listed spawner's `activeEffects.push`
  - Remove migrated `if (fx.is…)` branches from `updateAttackEffects` (registry handles them)
- **`game/client/test/vfx-primitives.test.js`**, **`game/client/test/renderer-spike-trap.test.js`**
  - Update assertions that grep `isLightColumn`, `isSpikeTrapSpike`, etc. to also accept `fx.kind`

## Verification: code
