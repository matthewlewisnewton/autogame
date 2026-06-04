# Attribute Cinder Snare DoT damage to the trap owner

When a Cinder Snare trap triggers it spawns an `inferno_pillar` area effect whose
per-tick radial damage is resolved in `updateAreaEffects()`. That `collectRadialHits`
call currently passes no `attackerId`, so killed enemies never get
`enemy.lastDamagedBy` set to the trap owner. A delayed DoT kill therefore misses or
misassigns card-drop credit. Carry the effect's `ownerId` into the tick damage path.

## Acceptance Criteria

- The `inferno_pillar` branch of `updateAreaEffects()` passes the effect's `ownerId`
  as `attackerId` to `collectRadialHits`, so enemies damaged/killed by the DoT have
  `enemy.lastDamagedBy === <trap owner playerId>`.
- A Cinder Snare trap trigger that DoT-kills an enemy results in that enemy's
  `lastDamagedBy` being the trap owner, so drop credit is attributed to the owner.
- No regression to the existing inferno_pillar callers (e.g. the spell that already
  uses `spawnInfernoPillarEffect`): `spawnInfernoPillarEffect` already stores
  `ownerId`, so attribution must work for both the trap path and any spell path.
- `cd game && pnpm test` is green, including a new/updated assertion for owner
  attribution.

## Technical Specs

- `game/server/simulation.js`:
  - In `updateAreaEffects()`, the `else if (effect.type === 'inferno_pillar')` branch
    (~line 1352): change the `collectRadialHits(effect.originX, effect.originZ,
    effect.range, effect.damagePerTick)` call to also pass
    `{ attackerId: effect.ownerId }` as the options argument (matching how other
    radial callers thread attribution, e.g. line ~1567/1572). `collectRadialHits`
    already sets `enemy.lastDamagedBy = attackerId` when `attackerId` is truthy
    (~line 871).
  - Confirm `spawnInfernoPillarEffect` (~line 1274) persists `ownerId` on the pushed
    effect (it does) so `effect.ownerId` is available at tick time; the Cinder Snare
    trap trigger path (~line 1615) passes `enc.ownerId` into it.
- `game/server/test/enchantment.test.js`:
  - Add a test that places/arms a Cinder Snare ground enchantment owned by a player,
    triggers it over an enemy, advances `updateAreaEffects()` through the DoT ticks
    until the enemy dies, and asserts the dead enemy's `lastDamagedBy` equals the
    trap owner's playerId.

## Verification: code
