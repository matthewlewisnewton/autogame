# Wire Loot Spawning to Real Enemy Death Paths

`spawnLoot()` exists and works, but is only called from the dead `damageEnemy`
socket handler — no client code ever emits that event. Enemies are actually
killed by card combat and minion attacks. Wire `spawnLoot()` into each of the
three real death paths so loot drops in actual gameplay.

## Acceptance Criteria
- In the **weapon-card branch** (`useCard` handler), before filtering dead
  enemies at line ~656, iterate `gameState.enemies` and call
  `spawnLoot(e.x, e.z)` for every enemy with `hp <= 0`
- In the **summon-card branch** (`useCard` handler), before filtering dead
  enemies at line ~703, iterate `gameState.enemies` and call
  `spawnLoot(e.x, e.z)` for every enemy with `hp <= 0`
- In **`updateMinions()`**, before filtering dead enemies at line ~534, iterate
  `gameState.enemies` and call `spawnLoot(e.x, e.z)` for every enemy with
  `hp <= 0`
- After the change, `spawnLoot` is called from at least three locations in the
  call graph reachable from normal gameplay (weapon use, summon use, minion AI)
- The existing `damageEnemy` socket handler may be left as-is (it will be
  cleaned up in sub-ticket 05) — the critical fix is that the three real paths
  call `spawnLoot`
- Server logs `[loot] spawned id=... value=...` when enemies die via card or
  minion combat

## Technical Specs
- **File**: `game/server/index.js`
- The existing `spawnLoot(x, z)` helper (line ~363) already does everything
  needed — 50% roll, random value 5–20, pushes to `gameState.loot`, logs.
- In each of the three death paths, replace the pattern:
  ```js
  gameState.enemies = gameState.enemies.filter(e => e.hp > 0);
  ```
  with:
  ```js
  for (const e of gameState.enemies) {
    if (e.hp <= 0) spawnLoot(e.x, e.z);
  }
  gameState.enemies = gameState.enemies.filter(e => e.hp > 0);
  ```
- `gameState.loot` is already included in `gameState`, which is emitted every
  tick via `stateUpdate` — no broadcast change needed.

## Verification: code
