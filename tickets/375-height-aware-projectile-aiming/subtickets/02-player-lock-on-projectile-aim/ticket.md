# 02 — Player lock-on projectile aim

When a player fires a projectile card while Z-targeting an enemy, compute aim from the shooter's full 3D position to the locked target's full 3D position and pass the tilted ray into the collectors from sub-ticket 01. Wire the client to send the locked enemy id on `useCard` so server-authoritative hit resolution matches lock-on intent.

## Acceptance Criteria

- `useCard` accepts an optional `lockTargetId` (enemy id). When present and the enemy is alive, server aim ignores client `rotation` for projectile resolution and instead uses the 3D vector from player to that enemy.
- Player weapon projectiles (`effect: 'projectile'`, `'fireball'`, `'returning_projectile'`, `'triple_returning_projectile'`) call the height-aware collectors with `originY` and `dirY` derived from lock-on aim.
- Player spell projectiles (`effect: 'ice_ball'`, `'chain_lightning'`) use the same lock-on 3D aim path.
- `dragons_breath` (`effect: 'dragons_breath'`) aims its initial cone along the lock-on 3D vector so elevated targets in range can be struck.
- `CARD_USED` payloads for these effects include `direction.y` (or equivalent) when the aim vector has a vertical component.
- `game/client/main.js` includes `lockTargetId: getLockedEnemyId()` (or `null`) in the `useCard` socket emit when lock-on is active.
- Server tests (extend `height_aware_projectiles.test.js`) fire each player projectile card listed above at an enemy offset in Y on the same `(x, z)` with `lockTargetId` set and assert a hit; the same setup **without** `lockTargetId` and flat `rotation` still misses.

## Technical Specs

- `game/server/index.js`:
  - Extend `resolveAttackRotation` or add `resolveProjectileAim(player, data, state)` that returns `{ rotation, dirX, dirY, dirZ, originY }`. When `data.lockTargetId` resolves to a live enemy, compute 3D aim via the helpers from sub-ticket 01; otherwise keep today's rotation → `(cos, 0, sin)` behavior.
  - Pass the new resolver into `cardEffects.setCallbacks`.
- `game/server/cardEffects.js`:
  - Replace per-card `Math.cos/sin(rotation)` blocks for projectile effects with the shared aim resolver.
  - Pass `originY` and `dirY` into `collectProjectileHits`, `collectReturningProjectileHits`, `collectChainLightningHits`, and `collectConeHits` (dragons_breath).
  - Include `direction.y` on emitted `CARD_USED` events when non-zero.
- `game/client/main.js`:
  - Import `getLockedEnemyId` from `lockOn.js`.
  - Add `lockTargetId: getLockedEnemyId() ?? undefined` to the `USE_CARD` emit payload (both weapon and spell paths if duplicated).
- `game/server/test/height_aware_projectiles.test.js`:
  - Integration-style cases per card: `fireball`, `ice_ball`, `arcane_bolt`, `chain_lightning`, `photon_slicer`, `infinite_disk`, `dragons_breath`.

## Verification: code
