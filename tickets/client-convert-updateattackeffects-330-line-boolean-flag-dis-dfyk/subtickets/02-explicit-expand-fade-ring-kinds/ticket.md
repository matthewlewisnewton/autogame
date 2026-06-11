# Replace positional `fx.radius` dispatch with explicit expand-fade ring kinds

## Description

The catch-all `if (fx.radius !== undefined)` branch in `updateAttackEffects` (~7427) mis-dispatches any effect that carries a `radius` field without a more specific flag checked earlier. Register an explicit expand-fade ring updater and assign `kind` on every spawner that currently relies on the positional radius check, then delete that branch.

## Acceptance Criteria

- `ATTACK_EFFECT_KINDS.EXPAND_FADE_RING` (or per-card sub-kinds sharing one updater) is registered in `attackEffectUpdaters.js` with the same expand→fade math as the old radius branch (`SUMMON_EXPAND_MS`, scale `fx.radius * expandT * 2`, opacity fade after expand)
- Every spawner that previously depended on bare `radius` sets `kind` on `activeEffects.push`: `spawnSummonEffect`, `spawnLegionMarshalRallyEffect` (ring), `spawnDivineGracePulseRing`, `spawnRestorationBeaconRing`, `spawnTelepipeCastEffect` (ring), `spawnPurifyingPulseHealRing`, `spawnThermalColumnScorchRing` / `spawnInfernoPillarEffect`, `spawnSpikeTrapEffect` (ring), `spawnVolatileExplosionEffect`, `spawnDragonsBreathScorch`, passage-unlock companion ring (~1748)
- `if (fx.radius !== undefined)` is removed from `updateAttackEffects`; radius alone never selects an updater
- Staggered rings (`createdAt` offset for heal/chrono waves) still hold at ~zero scale until their start time
- `pnpm test` passes: divine grace, inferno pillar, purifying pulse, thermal column, spike trap ring, summon effect, dragons breath scorch tests in `vfx-primitives.test.js` and `renderer-spike-trap.test.js`

## Technical Specs

- **`game/client/renderer/attackEffectUpdaters.js`**
  - Add `updateExpandFadeRing(fx, elapsed)` extracted from the old radius branch
  - Register under `ATTACK_EFFECT_KINDS.EXPAND_FADE_RING` (and optional aliases like `SPIKE_TRAP_RING`, `DRAGONS_BREATH_SCORCH` if they need distinct test hooks but share math)
- **`game/client/renderer.js`**
  - Add `kind` to each listed `activeEffects.push` payload; remove reliance on `spikeTrapRing` / `volatileBurst` / `isDragonsBreathScorch` as dispatch keys (may keep as metadata)
  - Delete the `fx.radius !== undefined` block from `updateAttackEffects`
- **`game/client/test/vfx-primitives.test.js`**, **`game/client/test/renderer-spike-trap.test.js`**
  - Update tests that locate effects via `fx.radius !== undefined` or `fx.spikeTrapRing` to assert `fx.kind` instead

## Verification: code
