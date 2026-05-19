# Loot Expiration, Dead Code Cleanup & .gitignore Fix

Address the three non-blocking nits from the round-1 review: unbounded loot
lifetime, the dead `damageEnemy` socket handler, and a stray `.git/` entry in
`.gitignore`.

## Acceptance Criteria
- **Loot expiration**: each loot entity gets a `createdAt` timestamp
  (`Date.now()`); the server game loop removes any loot older than 120 seconds
  (2 minutes) before emitting `stateUpdate`
- **Dead `damageEnemy` handler**: the `socket.on('damageEnemy', ...)` handler
  is removed from `game/server/index.js` (nothing emits it; the `spawnLoot`
  call inside it has been moved to the real death paths in sub-ticket 01)
- **`.gitignore`**: the `.git/` line is removed from the top-level
  `.gitignore` (Git never tracks `.git`, so the entry is a no-op and unrelated
  to this ticket)

## Technical Specs
- **Files**: `game/server/index.js`, `.gitignore`
- **Loot expiration**:
  - In `spawnLoot()`, add `createdAt: Date.now()` to the loot object pushed to
    `gameState.loot`
  - In the server game loop (`setInterval` that calls `updateEnemies` /
    `updateMinions`), before `io.emit('stateUpdate', gameState)`, add:
    ```js
    const now = Date.now();
    gameState.loot = gameState.loot.filter(l => (now - l.createdAt) < 120000);
    ```
- **Dead handler removal**:
  - Delete the entire `socket.on('damageEnemy', ...)` block
    (`game/server/index.js`, currently lines ~595–606)
- **`.gitignore`**:
  - Remove the `.git/` line from `/home/matt/workspace/autogame/.gitignore`

## Verification: code
