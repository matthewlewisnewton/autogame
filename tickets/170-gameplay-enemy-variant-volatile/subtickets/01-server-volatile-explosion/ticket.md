# Server: Volatile variant + on-death radial explosion

Add a `volatile` enemy variant to the 169 registry that, when a tagged enemy
dies, detonates a radial explosion damaging nearby players, minions, and other
enemies within a defined radius — reusing the existing `areaEffects` /
`updateAreaEffects` machinery in `game/server/simulation.js`. Queue the
detonation so the tick loop can broadcast it to clients. Cover the damage with
a server vitest test.

## Acceptance Criteria

- `VARIANT_DEFS` in `game/server/enemyVariants.js` gains a `volatile` entry with
  an `id`, human `name`, and explosion tuning fields (a numeric blast `radius`
  and `damage`). The existing `test` variant and `applyVariant`/
  `getVariantBonusDrop` seams keep working unchanged.
- When an enemy carrying `variant: 'volatile'` reaches `hp <= 0` and is removed
  (in `removeDeadEnemies` in `game/server/progression.js`), the server spawns a
  one-shot radial area effect at the enemy's `(x, z)` instead of silently
  removing it.
- The explosion is resolved through `updateAreaEffects` in
  `game/server/simulation.js` (a new `volatile_explosion` branch) and applies
  the configured `damage` to every player, minion, and living enemy whose
  distance from the blast origin is `<= radius`; entities outside the radius
  take no damage.
- Player damage goes through the existing `damagePlayer` path (so barrier/anchor
  rules still apply); a non-volatile enemy dying produces no explosion.
- Each detonation is recorded on a per-lobby pending queue (mirroring
  `state._pendingMinionBreaths`) carrying at least `{ x, z, radius }`, and
  `runGameLoopTick` in `game/server/index.js` drains that queue and emits a
  `volatileExplosion` event to the lobby room.
- A server vitest test asserts: a volatile enemy at hp 0 removed near a player
  reduces that player's hp by the configured damage after the area-effect tick,
  while a player positioned beyond the radius is unharmed; and that a normal
  (non-volatile) enemy death emits/queues no explosion.

## Technical Specs

- `game/server/enemyVariants.js`: add `volatile` to `VARIANT_DEFS` with
  `id: 'volatile'`, `name`, `radius`, `damage` (keep `apply: null`; optionally a
  `bonusDrop`). Variant selection in `applyVariant` already picks across
  `variantIds()`, so no change to the seam is required.
- `game/server/simulation.js`: export a helper (e.g. `spawnVolatileExplosion(x,
  z, def)`) that pushes a `{ type: 'volatile_explosion', originX, originZ,
  range, damagePerTick, ticksRemaining: 1, intervalMs: 0, lastTickAt, expiresAt }`
  entry onto `_gameState.areaEffects`, and add a `volatile_explosion` branch in
  `updateAreaEffects()` that damages players (via `damagePlayer`), minions, and
  enemies within `range` of the origin. Reuse `collectRadialHits` for enemies.
  Push the `{ x, z, radius }` record onto a pending queue on `_gameState`
  (e.g. `_gameState._pendingVolatileExplosions`).
- `game/server/progression.js`: in `removeDeadEnemies()`, for each dying enemy
  whose `variant` registry entry is `volatile`, call the new simulation helper
  before/while it is filtered out. `progression.js` already requires from
  `simulation.js` and the variant registry.
- `game/server/index.js`: in `runGameLoopTick`, after the existing
  `_pendingMinionBreaths` drain, drain `state._pendingVolatileExplosions` and
  `io.to(lobby.id).emit('volatileExplosion', record)`; initialize the queue
  alongside `areaEffects` in the state factory (line ~87).
- Test: add to `game/server/test/enemy_variants.test.js` (or a new
  `volatile_explosion.test.js`) using the existing simulation/progression test
  harness pattern.

## Verification: code
