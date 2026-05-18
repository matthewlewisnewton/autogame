# Server-Side Weapon Hit Resolution

Implement server-authoritative hit detection and damage application for Weapon-type cards. When a player uses a Weapon card, the server resolves which enemies are hit, applies damage, removes dead enemies, and broadcasts the result to all clients.

## Acceptance Criteria
- Server handles the `useCard` socket event for cards whose `type` is `"weapon"` (looked up via `CARD_DEFS` or server-side card data)
- On a valid weapon use, the server computes a hitbox or ray in the player's facing direction and checks all enemies in `gameState.enemies` for overlap
- Each hit enemy has its `hp` reduced by the weapon's damage value (a fixed amount, e.g. 15–25 per hit)
- Any enemy whose `hp` drops to 0 or below is removed from `gameState.enemies`
- The server emits a `cardUsed` event to all connected clients containing: the attacker's socket id, attack origin/direction, list of hit enemy ids, and updated enemy state
- If the card is not a weapon type, the server ignores the event (no error, no broadcast)

## Technical Specs
- **File**: `game/server/index.js`
- Replace the current no-op `useCard` handler with logic that:
  1. Validates `slotIndex` and `cardId`, looks up the card definition to confirm `type === 'weapon'`
  2. Gets the player's position (`x`, `z`) and `rotation` from `gameState.players[socket.id]`
  3. Defines an attack range (e.g., a forward cone or sphere of radius ~5 units) and checks distance/angle to each enemy
  4. Applies a fixed damage value (e.g., `15`) to each hit enemy
  5. Filters dead enemies from `gameState.enemies`
  6. Broadcasts `io.emit('cardUsed', { playerId, cardId, origin: {x, z}, direction, hits: [{enemyId, hp}] })`
- Add a small server-side `CARD_DEFS` lookup object (mirror the weapon entries from `game/client/cards.js`) so the server can resolve card type and damage without importing client code

## Verification: code
