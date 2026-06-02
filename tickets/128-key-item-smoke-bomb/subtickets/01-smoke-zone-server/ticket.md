# Smoke Bomb — Server Zone Spawn, Accuracy Debuff & Cooldown

Redefine the `smoke_bomb` key item as **Smoke Veil**: `useKeyItem` spawns a 2s
smoke zone fixed at the caster's cast position. While a player stands inside an
active smoke zone, enemy attacks against that player have a high chance to miss
(reduced hit chance). The item runs on an ~8s cooldown.

**Documented design choices:**
- The zone **stays fixed at the cast point** (it does not follow the player).
- Effect rule: **reduced hit chance** — each enemy attack (melee windup
  resolution and ranged/phase-beam hit) against a player inside an active zone
  is rolled against `missChance`; on a miss the attack deals no damage.

## Acceptance Criteria

- `KEY_ITEM_DEFS.smoke_bomb` in `game/server/progression.js` is redefined to the
  Smoke Veil concept: `cooldownMs: 8000`, a `durationMs` of `2000`, a zone
  `radius` (e.g. `4`), and a `missChance` (e.g. `0.75`). Description text matches
  "short fog at feet; enemies lose accuracy".
- `smoke_bomb` is added to the implemented allow-list in the `useKeyItem` handler
  in `game/server/index.js` (no longer returns `not_implemented`).
- Using `smoke_bomb` while not on cooldown stores an active smoke zone fixed at
  the caster's `{x, z}` with an expiry timestamp (`now + durationMs`) and the
  zone `radius`, sets `player.keyItemCooldownUntil = now + def.cooldownMs`, emits
  `keyItemUsed` with `{ ok: true, keyItemId: 'smoke_bomb', cooldownUntil, x, z, radius, durationMs }`, and broadcasts `stateUpdate`.
- Using `smoke_bomb` while on cooldown returns `{ ok: false, reason: 'on_cooldown', remainingMs }` and does not spawn a zone.
- Active smoke zones are included in the broadcast state snapshot so clients can
  render them, and expired zones are pruned (removed once `now >= expiry`).
- Enemy attacks (melee windup resolution and ranged phase-beam damage) against a
  player whose position is within an active zone's radius miss with probability
  `missChance`; a missed attack applies no damage.
- A new test file `game/server/test/smoke_bomb.test.js` verifies: (a) using the
  item sets the ~8s cooldown and creates a zone at the caster's position; (b)
  over many simulated enemy attacks, the miss rate against a player standing in
  an active zone is measurably higher than with no zone present; (c) the zone is
  pruned after `durationMs` elapses.

## Technical Specs

- `game/server/progression.js`: rewrite the `smoke_bomb` entry in
  `KEY_ITEM_DEFS` (id, name `Smoke Veil`, description, `type: 'stealth'` or
  `'utility'`, `cooldownMs: 8000`, `durationMs: 2000`, `radius: 4`,
  `missChance: 0.75`). Keep it exported via the existing `KEY_ITEM_DEFS` export.
- `game/server/index.js`: in the `socket.on('useKeyItem', …)` handler (~line
  2706), add `'smoke_bomb'` to the implemented allow-list condition (~line 2738)
  and add a `if (keyItemId === 'smoke_bomb') { … }` branch that records the zone.
  Store zones on the lobby/game state (e.g. `state.smokeZones = []` with entries
  `{ ownerId, x, z, radius, expiry }`), mirroring how transient effects are kept.
  Include `smokeZones` (active, non-expired) in `stateSnapshot()`.
- `game/server/simulation.js`: add a helper (e.g. `isInSmokeZone(player)`) that
  checks `_gameState.smokeZones` for a non-expired zone containing the player's
  `{x, z}`, and prune expired zones in the enemy tick (`updateEnemies`). In the
  windup-resolution path (~line 1663, where `damagePlayer(enemy.windupTargetId,
  …)` is called) and in the ranged phase-beam path (~line 930, the
  `damagePlayer(playerId, damage, { ranged: true })` call), skip applying damage
  with probability `missChance` when the target player is in an active zone.
- Reuse the existing `Date.now()` cooldown pattern and `io.to(lobby.id).emit('stateUpdate', stateSnapshot())` broadcast used by sibling key items.

## Verification: code
