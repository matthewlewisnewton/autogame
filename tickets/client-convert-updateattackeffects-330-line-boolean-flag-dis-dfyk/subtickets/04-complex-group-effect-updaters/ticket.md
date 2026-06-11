# Migrate complex multi-child group effect updaters

## Description

Several attack effects animate `THREE.Group` children via `userData` tags (Aegis Sentinel, Solar Edge, Mana Prism, Glacier shards, Event Horizon, Gravity Well, Mirror Ward, Wyrmflare cone, fire trail). Extract each into a named registry updater and attach `kind` at spawn time.

## Acceptance Criteria

- Registry entries exist for: `aegisSentinelShield`, `aegisSentinelDeploy`, `glacierRuptureShards`, `solarEdgeImpact`, `manaPrismEffect`, `eventHorizonEffect`, `gravityWellPull` (handles ring/void/inflow via sub-kind or internal branch), `mirrorWardShell`, `dragonsBreathCone`, `fireTrail`
- Spawners set `kind`: `spawnAegisSentinelShieldFlourish`, `spawnAegisSentinelDeployEffect`, `spawnGlacierRuptureShards`, `spawnSolarEdgeImpactFlourish`, `spawnManaPrismEffect`, `spawnEventHorizonEffect`, `spawnGravityWellEffect`, `spawnMirrorWardShellEffect`, `spawnDragonsBreathEffect` (cone), `spawnFireTrailEffect`
- `mirrorWardShell` expiry still clears `mirrorWardShellsByPlayer` when `fx.playerId` is set
- Child `userData` dispatch (`isAegisSentinelRing`, `isSolarEdgeDisc`, `isEventHorizonCore`, `isGravityWellRing`, etc.) stays inside the registered updater functions unchanged
- `pnpm test` passes for aegis sentinel, solar edge, mana prism, glacier shards, event horizon, gravity well, mirror ward, dragons breath, fire trail cases in `vfx-primitives.test.js`

## Technical Specs

- **`game/client/renderer/attackEffectUpdaters.js`**
  - Move group-child update loops from `updateAttackEffects` for: `isAegisSentinelShield`, `isAegisSentinelDeploy`, `isGlacierRuptureShards`, `isSolarEdgeImpact`, `isManaPrismEffect`, `isEventHorizonEffect`, `isGravityWellPull`, `isMirrorWardShell`, `isDragonsBreathCone`, `isFireTrail`
  - Import needed constants from `renderer.js` or colocate shared VFX constants to avoid circular imports (re-export pattern used by other `./renderer/*` modules)
- **`game/client/renderer.js`**
  - Set `kind` on listed spawners; delete migrated flag branches from `updateAttackEffects`
  - Pass `mirrorWardShellsByPlayer` into updater context if needed for shell expiry side effect
- **`game/client/test/vfx-primitives.test.js`**
  - Align tests with `fx.kind` where they currently key off group flags only

## Verification: code
