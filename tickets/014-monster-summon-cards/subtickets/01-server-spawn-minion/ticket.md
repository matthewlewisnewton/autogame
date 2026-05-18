# Server: Spawn Minion Entities on Monster Card Use

When a player uses a `type: 'monster'` card (e.g. `dungeon_drake`), the server spawns a persistent minion entity owned by that player. The minion has its own `hp` and a limited lifetime (`ttl` in seconds). It despawns automatically when `hp` reaches 0 or its duration expires.

## Acceptance Criteria
- `gameState` gains a `minions` array (initialized to `[]`)
- Using a monster card (`useCard` with a card whose `CARD_DEFS` entry has `type: 'monster'`) spawns a new minion object in `gameState.minions`
- Each minion has shape `{ id, ownerId, x, z, hp, ttl }` — `x`/`z` start at the player's position, `hp` defaults to 50, `ttl` defaults to 30 seconds
- The game-loop interval decrements each minion's `ttl` and removes any minion whose `ttl <= 0` or `hp <= 0`
- Dead minions are also cleaned up on disconnect (owner's minions removed when owner disconnects)
- Minion state is broadcast to all clients via the existing `stateUpdate` mechanism (added to `gameState`)

## Technical Specs
- **File**: `game/server/index.js`
- Add `minions: []` to `gameState` object
- In the `useCard` handler, add an `if (cardDef.type === 'monster')` branch after the summon branch:
  - Generate minion id via `crypto.randomUUID()`
  - Push `{ id, ownerId: socket.id, x: player.x, z: player.z, hp: 50, ttl: 30 }` to `gameState.minions`
  - Emit `cardUsed` event: `{ playerId: socket.id, cardId, slotIndex, origin: { x, z } }`
- In the existing `setInterval` game loop, after `updateEnemies()`, add a `updateMinions()` call that:
  - Decrements `ttl` by `dt` (1/TICK_RATE) for each minion
  - Filters out minions with `ttl <= 0` or `hp <= 0`
- In the `disconnect` handler, filter out any minions whose `ownerId === socket.id`

## Verification: code
