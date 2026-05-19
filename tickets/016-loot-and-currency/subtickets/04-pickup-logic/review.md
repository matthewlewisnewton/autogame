# Review — 04-pickup-logic (CODER self-review)

## Acceptance Criteria Checklist

### ✅ Client proximity check every frame
`game/client/main.js` — inside `animate()`, after `updateMyPlayer(delta)`, iterates `gameState.loot`, checks `Math.hypot(myX - loot.x, myZ - loot.z) <= 2`, emits `socket.emit('lootPickup', { lootId: loot.id })` and `break`s (one per frame). Guarded by `gameState && gameState.loot && gameState.loot.length > 0`.

### ✅ Server finds loot by id
`game/server/index.js` — `socket.on('lootPickup', ...)` uses `gameState.loot.findIndex(l => l.id === data.lootId)`. Returns early if not found.

### ✅ Server distance validation (≤ 3.0)
`Math.hypot(player.x - loot.x, player.z - loot.z)` compared against `3`. If `> 3` the event is ignored (anti-cheat).

### ✅ On valid pickup: currency += value, loot removed, logged
`player.currency += loot.value`, `gameState.loot.splice(lootIdx, 1)`, and `console.log` with the exact format specified in the ticket.

### ✅ Next stateUpdate reflects changes
The existing server game loop already emits `io.emit('stateUpdate', gameState)` every tick. After `currency` is incremented and loot is spliced, the next broadcast carries the updated state to all clients.

### ✅ Loot cannot be picked up twice
The server removes the loot immediately (`splice`). A subsequent `lootPickup` for the same `lootId` hits `findIndex === -1` and returns early.

## Code Style / Consistency
- Uses same patterns as existing handlers (`socket.on`, early returns, `Math.hypot`)
- Log format matches the ticket spec exactly
- No new dependencies
- Ports and start commands unchanged

## Verdict
**PASS** — all acceptance criteria met, no issues found.
