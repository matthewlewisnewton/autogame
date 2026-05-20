# Spawner ENEMY_DEFS Entry

Add a `spawner` entry to `ENEMY_DEFS` with the stats and spawning-specific fields defined in the parent ticket. This sub-ticket is purely about registering the data — no behavior changes yet.

## Acceptance Criteria

- `ENEMY_DEFS.spawner` exists with the following fields:
  - `hp: 60`, `chaseSpeed: 1.8`, `wanderSpeed: 0.9`, `attackDamage: 8`, `attackWindupMs: 900`
  - `spawnIntervalMs: 4000`, `spawnMaxAlive: 3`, `spawnType: 'skirmisher'`
- `spawnEnemy()` accepts `'spawner'` as a valid type (no longer throws "Unknown enemy type").
- Existing enemy types (grunt, skirmisher, miniboss) are unchanged.
- Unit tests verify the spawner definition fields and that `spawnEnemy('spawner')` succeeds.

## Technical Specs

- **File:** `game/server/index.js` — add `spawner` key to `ENEMY_DEFS` object
- **File:** `game/server/test/server.test.js` — add tests under `ENEMY_DEFS` describe block for spawner fields and `spawnEnemy` acceptance

## Verification: code
