# 07-ground-enchantment-traps-spherical

Ground enchantment traps (`spike_trap`, `cinder_snare`) trigger on flat XZ distance and never record the cast origin's Y, so an enemy far above/below the trap but XZ-inside still springs it. Store the origin Y when the trap is spawned and trigger with true 3D spherical distance.

## Acceptance Criteria

- `spawnGroundEnchantment` stores a `y` field on each ground enchantment, resolved from the cast origin (caster's world Y via `getEntityWorldY`, or floor height at the trap's x/z via `resolveAoeOriginY` when no caster Y is available).
- The trap trigger loop in `updateEnchantments` uses 3D spherical distance (`sphericalDistanceToEntity(enc.x, enc.y, enc.z, enemy)`) instead of `Math.hypot(enemy.x - enc.x, enemy.z - enc.z)`.
- An elevated enemy whose 3D distance to the trap is ≤ `enc.radius` triggers the trap (both `spike_trap` damage and `cinder_snare` DoT spawn paths).
- An enemy that is XZ-inside the trap radius but whose height difference puts its 3D distance > `enc.radius` does NOT trigger the trap.
- Existing enchantment behavior (arming, expiry, one-shot disarm, `_pendingSpikeTrapTriggers`, cinder snare's `spawnInfernoPillarEffect`) is unchanged apart from the distance check.
- New tests in `game/server/test/enchantment.test.js` prove: elevated in-sphere enemy triggers; XZ-inside/out-of-sphere enemy does not — for both `spike_trap` and `cinder_snare`.
- `pnpm test:quick` (from `game/`) passes.

## Technical Specs

- `game/server/simulation.js`:
  - `spawnGroundEnchantment(x, z, cardDef, ownerId)` (~line 2226): accept/resolve an origin Y and store it as `y` on the pushed enchantment object. Simplest correct form: add an optional `originY` parameter and resolve via `resolveAoeOriginY(x, originY, z)` so callers without a Y fall back to floor height at the trap position.
  - `updateEnchantments` (~line 2378): replace the 2D `Math.hypot` with `sphericalDistanceToEntity(enc.x, enc.y, enc.z, enemy)`.
- `game/server/cardEffects.js`:
  - Trap spawn call site (~line 1228, the `spike_trap`/`cinder_snare` branch): pass the caster's world Y (`getEntityWorldY(player)` — already imported or importable from `./simulation`) so the trap records where it was actually cast.
- `game/server/test/enchantment.test.js`: add the four cases above, placing enemies at different `y` values (directly setting `enemy.y` is sufficient since `getEntityWorldY` honors a finite `entity.y`).

## Verification: code
