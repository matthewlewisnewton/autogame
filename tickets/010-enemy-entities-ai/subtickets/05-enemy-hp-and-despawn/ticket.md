# Enemy HP & Death / Despawn

Each enemy carries an `hp` value. When `hp` drops to 0 or below, the enemy is removed from `gameState.enemies` so it disappears from all clients on the next `stateUpdate`. Expose a server-side test hook socket event `'damageEnemy'` that lets any client deal damage to a specific enemy by id — this enables verification before the full combat system exists.

## Acceptance Criteria
- Each enemy has `hp` (starting at 50, set in sub-ticket 01)
- The server listens for a `'damageEnemy'` socket event with payload `{ enemyId, amount }`
- Receiving `'damageEnemy'` subtracts `amount` from the target enemy's `hp`
- When an enemy's `hp <= 0`, it is removed from `gameState.enemies` (filtered out of the array)
- Removed enemies no longer appear in `stateUpdate` broadcasts, so clients clean up their meshes automatically (via the mesh-pool cleanup in sub-ticket 02)

## Technical Specs
- **File**: `game/server/index.js`
- Inside the `io.on('connection')` handler, add:
  ```
  socket.on('damageEnemy', (data) => {
    if (!data || !data.enemyId || typeof data.amount !== 'number') return;
    const enemy = gameState.enemies.find(e => e.id === data.enemyId);
    if (!enemy) return;
    enemy.hp -= data.amount;
    if (enemy.hp <= 0) {
      gameState.enemies = gameState.enemies.filter(e => e.id !== data.enemyId);
    }
  });
  ```
- No client-side changes required for this sub-ticket; the existing mesh-pool cleanup in sub-ticket 02 handles removal visually

## Verification: code
