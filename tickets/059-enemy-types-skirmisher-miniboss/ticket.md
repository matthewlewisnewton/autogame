# Enemy Types: Skirmisher and Miniboss

## Context

Today the game has **one** enemy archetype. Every spawn in `spawnEnemies()` is
identical: 50 HP, shared chase/windup AI, and a red cone mesh on the client.
There is no `type` field on enemy objects and no `ENEMY_DEFS` table.

This ticket introduces a small enemy-definition layer and adds **two** new
archetypes alongside the existing default (renamed **grunt**).

## Goal

Players should encounter mixed encounters: fragile fast pursuers and a slow,
tanky miniboss — not five clones of the same stat block.

## Enemy Definitions

Add a server-owned `ENEMY_DEFS` map (and export for tests). Suggested values —
tune during implementation:

| id | role | hp | chaseSpeed | wanderSpeed | attackDamage | attackWindupMs | notes |
|----|------|-----|------------|-------------|--------------|----------------|-------|
| `grunt` | default | 50 | 2.5 | 1.0 | 10 | 800 | current behavior |
| `skirmisher` | fast / low HP | 20 | 4.5 | 1.5 | 6 | 500 | smaller mesh, brighter color |
| `miniboss` | slow / high HP | 150 | 1.2 | 0.6 | 18 | 1200 | larger mesh, distinct color |

- Store `type` (or `defId`) on each `gameState.enemies[]` entry at spawn time.
- `updateEnemies()` reads per-type stats from defs instead of global constants
  where behavior differs (speed, damage, windup). Shared state machine
  (idle → chase → windup → recover) can stay one function.
- Client `ENEMY_MAX_HP` hardcode must become per-enemy max HP from defs (via
  state snapshot or `maxHp` on each enemy).

## Spawning

- Replace the fixed “5 identical grunts” loop with a small spawn table, e.g.:
  - 3× `skirmisher`
  - 1× `grunt`
  - 1× `miniboss`
- Cap total enemies at run start (~5) so performance stays similar to today.
- `ensureNearbyEnemy()` should spawn a `grunt` unless a debug scenario specifies
  otherwise.
- Run objective `totalEnemies` must count all spawned types.

## Client Visuals

- One mesh variant per type (scale/color/geometry); grunt keeps the current cone.
- Health bar color scaling uses that enemy’s `maxHp`, not a global 50.

## Acceptance Criteria

- Server has `ENEMY_DEFS` with at least `grunt`, `skirmisher`, `miniboss`.
- Each enemy in state includes a type id; unknown types are rejected at spawn.
- `spawnEnemies()` produces a mixed pack per the spawn table.
- Skirmishers move faster and die quicker; miniboss is slower and survives longer.
- Client renders distinguishable meshes per type.
- Health bars reflect correct max HP per enemy.
- Existing combat (cards, minions, loot on kill, run objective) works for all types.
- Unit/integration tests cover defs validation and at least one kill per new type.

## Files

- `game/server/index.js`
- `game/client/main.js`
- `game/server/test/server.test.js`
- `game/server/test/integration.test.js`

## Out of Scope

- Spawner enemy that summons skirmishers → `060-enemy-type-spawner`
- Room-based spawn weights, bosses with phases, new attack patterns
