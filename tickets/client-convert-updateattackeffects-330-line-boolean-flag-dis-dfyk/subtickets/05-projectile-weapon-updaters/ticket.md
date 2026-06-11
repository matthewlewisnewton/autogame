# Migrate projectile, weapon, and returning effect updaters

## Description

Combat-facing effects—directional projectiles, weapon cones, thrust animations, chain lightning, and returning corridor weapons—still live in the tail of the `updateAttackEffects` flag chain including the legacy fall-through default. Register explicit kinds for each and remove their `if` branches.

## Acceptance Criteria

- Registry entries exist for: `fireballProjectile`, `glacialOrbProjectile`, `arcaneBoltProjectile`, `chainLightning`, `returningProjectile`, `legacyProjectile`, `weaponCone`, `rustyShiv`
- Spawners / branches in `spawnAttackEffect` set `kind` on push for: fireball, glacial orb, arcane bolt, permafrost lance (legacy projectile), returning weapons (`returning: true`), generic weapon mesh (legacy), `isWeaponCone`, `isRustyShiv`, and `spawnChainLightningEffect`
- Legacy fall-through default at the bottom of `updateAttackEffects` becomes `ATTACK_EFFECT_KINDS.LEGACY_PROJECTILE` (travel + scale/opacity shrink + manual dispose)
- Returning projectile multi-pass timing (`returnPasses`, `passDuration`) is unchanged
- `pnpm test` passes (`spawnAttackEffect` paths, rusty shiv, weapon cone, chain lightning if covered; `main.test.js` hit-spark cleanup unaffected)

## Technical Specs

- **`game/client/renderer/attackEffectUpdaters.js`**
  - Extract updaters from branches: `isFireballProjectile`, `isGlacialOrbProjectile`, `isArcaneBoltProjectile`, `fx.returning`, legacy default (~7927), `isWeaponCone`, `isRustyShiv`, `isChainLightning`
- **`game/client/renderer.js`**
  - In `spawnAttackEffect` (~4187), set `kind` per weapon/effect branch instead of relying on implicit fall-through
  - Remove migrated branches from `updateAttackEffects`
- **`game/client/test/vfx-primitives.test.js`**, **`game/client/test/main.test.js`**
  - Update any assertions that depend on flag-only dispatch for projectiles

## Verification: code
