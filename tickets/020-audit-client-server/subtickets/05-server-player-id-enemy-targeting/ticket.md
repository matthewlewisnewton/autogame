# Server Player ID — Enemy Windup Targeting

Server player objects are keyed by `socket.id` in `gameState.players` but never store an `id` field on the player object itself. `updateEnemies()` iterates `Object.values(gameState.players)` to find the nearest player, then stores `nearestPlayer.id` as `enemy.windupTargetId`. Because `nearestPlayer.id` is `undefined`, the windup-strike lookup `gameState.players[enemy.windupTargetId]` always fails — enemies cancel their attack instead of calling `damagePlayer()`.

Add a stable `id` field to every server player object so that enemy windup targeting resolves correctly and enemies can damage connected players.

## Acceptance Criteria
- Every player object created on socket connection has a stable `id` field equal to `socket.id`.
- `enemy.windupTargetId` is set to that `id` (a non-undefined string) when an enemy enters windup state.
- When windup expires, `gameState.players[enemy.windupTargetId]` resolves to the correct player object.
- `damagePlayer()` is called on that player, reducing their HP by `ENEMY_DEFS[enemy.type].attackDamage`.
- An integration test verifies that after a player stands still near an enemy long enough for windup + strike, the player's HP drops below the starting value.

## Technical Specs
- **File**: `game/server/index.js` — In the `socket.on('connection', ...)` handler, where `gameState.players[socket.id]` is initialized, add `id: socket.id` to the player object literal.
- **File**: `game/server/test/integration.test.js` — Add a test that:
  1. Connects a client, waits for `init`.
  2. Places a single enemy within `ENEMY_ATTACK_RANGE` of the player (or uses the existing `spawnEnemy` helper).
  3. Waits for at least `ENEMY_DEFS.grunt.attackWindupMs + ENEMY_ATTACK_RECOVERY_MS + buffer` to let the game tick process windup → strike.
  4. Asserts that the player's HP is strictly less than `MAX_HP` (i.e., damage was applied).
- **No other files changed.** Do not modify client code, config, dungeon generation, or any other server logic.

## Verification: code
