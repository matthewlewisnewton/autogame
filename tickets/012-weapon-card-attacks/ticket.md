# Weapon Card Attacks

Implement multi-use Weapon cards — fast, low-cost attacks (a sword slash or a
projectile) that damage enemies. Depends on 010 (enemies) and 011 (card hand).

## Acceptance Criteria
- Using a Weapon card spawns a visible attack in the 3D scene — a projectile or
  a slash arc originating from the player, in the direction they face
- The attack damages any enemy it hits, reducing that enemy's `hp`
- An enemy whose `hp` reaches 0 is removed from the world
- Weapon cards consume one charge per use (via the ticket-011 hand system)
- Attacks are server-authoritative and broadcast so all clients see them

## Technical Specs
- **Files**: `game/server/index.js`, `game/client/main.js`,
  `game/client/cards.js`
- **Server**: handle the `useCard` event for `weapon`-type cards — resolve hits
  against `gameState.enemies`, apply damage, broadcast a `cardUsed` event with
  the attack details and updated enemy state.
- **Client**: on `cardUsed`, render the projectile/slash effect and its motion.
