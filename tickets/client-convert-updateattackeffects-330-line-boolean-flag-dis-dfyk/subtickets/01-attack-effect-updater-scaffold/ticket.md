# Attack-effect updater registry scaffold and shared primitives

## Description

`updateAttackEffects` in `game/client/renderer.js` (~7092–7946) is a long boolean-flag chain. Introduce a dedicated updater registry module and refactor the loop to dispatch on `fx.kind` with shared step-then-expire plumbing. Migrate the six well-tested shared primitives first so later sub-tickets can register additional kinds without touching loop structure.

## Acceptance Criteria

- New module `game/client/renderer/attackEffectUpdaters.js` exports `ATTACK_EFFECT_KINDS`, an `ATTACK_EFFECT_UPDATERS` map, and a `runAttackEffectUpdater(fx, elapsed)` helper
- Shared helpers extract duplicated expiry/disposal (`elapsed >= fx.duration` → `disposeEffectObject` → splice) so individual updaters only animate
- `updateAttackEffects` looks up `fx.kind` in the registry first; unmigrated effects still fall through to the existing flag chain (transitional)
- These kinds are registered and spawners set `kind` on push: `particleBurst`, `projectileTrail`, `impactDecal`, `telegraphRing`, `hitSpark`, `lightningArc`, `passageUnlockGate`
- Migrated updaters preserve current animation math (opacity fade, travel, scale pulse, etc.) byte-for-byte
- `pnpm test` passes (`game/client/test/vfx-primitives.test.js` shared-primitive cases and any passage-unlock tests)

## Technical Specs

- **`game/client/renderer/attackEffectUpdaters.js`** (new)
  - Define `ATTACK_EFFECT_KINDS` string constants
  - Export `ATTACK_EFFECT_UPDATERS` map: `(fx, elapsed) => void` per kind
  - Export `runAttackEffectUpdater(fx, elapsed)` and `shouldExpireAttackEffect(fx, elapsed)` / `disposeAttackEffect(fx, activeEffects, index)` helpers
  - Move update logic from `updateAttackEffects` branches: `isParticleBurst`, `isProjectileTrail`, `isImpactDecal`, `isTelegraphRing`, `isHitSpark`, `isLightningArc`, `isPassageUnlockGate`
- **`game/client/renderer.js`**
  - Import registry helpers near other `./renderer/*` imports
  - Refactor `updateAttackEffects` loop: compute `elapsed`, call `runAttackEffectUpdater` when `fx.kind` is set, else keep legacy `if (fx.is…)` chain
  - Set `kind` in spawners: `spawnParticleBurst`, `spawnProjectileTrail`, `spawnImpactDecal`, `spawnTelegraphRing`, `spawnHitSpark`, `spawnLightningArc`, passage-unlock gate push (~1724)
- **`game/client/test/vfx-primitives.test.js`**
  - Optionally assert `fx.kind` on migrated spawns (flags may remain during transition)

## Verification: code
