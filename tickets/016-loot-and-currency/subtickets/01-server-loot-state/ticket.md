# Server Loot State & Drop on Enemy Death

Add a `loot` array to `gameState` and a `currency` field per player. When an enemy is killed (removed from `gameState.enemies`), roll a 50 % chance to spawn a loot entity at the enemy's last position.

## Acceptance Criteria
- `gameState.loot` exists as an array and is included in every `stateUpdate` emission
- Each player object in `gameState.players` has a `currency` field initialized to `0`
- When an enemy's HP drops to 0 (via `damageEnemy` socket event), the server spawns a loot item at the enemy's `{x, z}` with a random integer value between 5 and 20 (inclusive), on a 50 % probability roll
- Spawned loot items have a unique `id` (e.g. `crypto.randomUUID()`) and a numeric `value`
- The server logs loot spawns (e.g. `[loot] spawned id=… value=…`)

## Technical Specs
- **File**: `game/server/index.js`
- Add `loot: []` to `gameState` object
- Add `currency: 0` to the player init block inside `io.on('connection', …)`
- In the `damageEnemy` handler, after confirming `enemy.hp <= 0`, call a helper `spawnLoot(enemy.x, enemy.z)` that:
  - rolls `Math.random() < 0.5`
  - pushes `{ id: crypto.randomUUID(), x, z, value: Math.floor(Math.random() * 16) + 5 }` to `gameState.loot`
- The existing `stateUpdate` interval already emits `gameState` — no change needed there

## Verification: code
