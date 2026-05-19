# Loot Pickup Logic (Server + Client)

Implement the full pickup flow: client detects proximity to loot, emits a `lootPickup` event; server validates distance, adds the loot value to the player's `currency`, removes the loot from `gameState.loot`, and broadcasts the change.

## Acceptance Criteria
- The client checks the distance from the player (`myX`, `myZ`) to each loot item every frame; when distance ≤ 2.0, it emits `socket.emit('lootPickup', { lootId })`
- The server handles `lootPickup` by:
  - Finding the loot item by `id` in `gameState.loot`
  - Computing server-side distance from the player's server position to the loot's `{x, z}`
  - If distance ≤ 3.0: adding `loot.value` to `player.currency`, removing the loot from `gameState.loot`, and logging the pickup
  - If distance > 3.0: ignoring the event (anti-cheat)
- After pickup, the next `stateUpdate` reflects the increased `currency` and the reduced `loot` array (so all clients see the change)
- A loot item can never be picked up twice (it is removed from `gameState.loot` immediately on first valid pickup)

## Technical Specs
- **Files**: `game/server/index.js`, `game/client/main.js`
- **Server** (`game/server/index.js`):
  - Add `socket.on('lootPickup', (data) => { … })` handler inside the `io.on('connection', …)` block
  - Handler validates `data.lootId`, finds loot in `gameState.loot`, checks `Math.hypot(player.x - loot.x, player.z - loot.z) <= 3`, then updates `player.currency += loot.value` and splices loot from array
  - Log: `console.log(`[loot] picked up id=${loot.id} value=${loot.value} by ${socket.id} (currency=${player.currency})`)`
- **Client** (`game/client/main.js`):
  - Inside the `animate()` loop (after position update), iterate `gameState.loot` and check `Math.hypot(myX - loot.x, myZ - loot.z) <= 2`; on first match, `socket.emit('lootPickup', { lootId: loot.id })` and break (one pickup per frame)

## Verification: code
