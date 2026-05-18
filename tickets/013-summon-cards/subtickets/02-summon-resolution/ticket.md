# Summon Card Resolution (Cost, Validation, AoE Damage, Consumption)

Extend the server's `useCard` handler so that **summon**-type cards are resolved: the server validates that the player has enough Magic Stones, deducts the cost, applies radial AoE damage to all enemies within a defined radius, and emits a `cardUsed` event. The card is single-use — it is consumed on play.

## Acceptance Criteria
- Each summon card definition has a `magicStoneCost` field (e.g. `battle_familiar` costs 50 Magic Stones)
- When a player plays a summon card, the server checks that the player's `magicStones >= magicStoneCost`; if not, the request is rejected and the client receives an error event
- On success, the server deducts the cost from the player's `magicStones`
- The server applies a fixed `summonDamage` (e.g. 40) to **every** enemy within a `SUMMON_RADIUS` (e.g. 10 units) of the player's position
- Dead enemies are removed from `gameState.enemies`
- The server emits a `cardUsed` event containing the summon data (playerId, cardId, origin, radius, hits list) so the client can render the effect
- The summon card is single-use: after a successful play, the card is consumed (already handled by existing charge/exhaust logic since summon cards have `charges: 1`)

## Technical Specs
- **`game/client/cards.js`**:
  - Add `magicStoneCost` and `damage` fields to summon-type card definitions (e.g. `battle_familiar: { ..., magicStoneCost: 50, damage: 40 }`)
- **`game/server/index.js`**:
  - Define `SUMMON_RADIUS = 10`
  - In `CARD_DEFS`, add `magicStoneCost` and `damage` to the `battle_familiar` entry
  - In the `useCard` handler, after the existing weapon block, add an `else if (cardDef.type === 'summon')` branch:
    1. Validate `player.magicStones >= cardDef.magicStoneCost`; if not, `socket.emit('cardError', { reason: 'not enough magic stones' })` and `return`
    2. Deduct: `player.magicStones -= cardDef.magicStoneCost`
    3. Compute radial AoE: iterate `gameState.enemies`, check `Math.hypot(enemy.x - player.x, enemy.z - player.z) <= SUMMON_RADIUS`; apply `cardDef.damage` to each hit enemy
    4. Remove dead enemies
    5. `io.emit('cardUsed', { playerId: socket.id, cardId: data.cardId, origin: { x: player.x, z: player.z }, radius: SUMMON_RADIUS, hits })`
- **`game/client/main.js`**:
  - Listen for `cardError` socket event; when received, show a brief toast/message to the user (e.g. append a short `<div>` with "Not enough Magic Stones!" that auto-removes after 2 seconds)
  - In the existing `cardUsed` handler, handle summon-type events (check `!weaponCardIds.has(data.cardId)`) — for now no visual yet (that's sub-ticket 03), but the event must be received without error

## Verification: code
