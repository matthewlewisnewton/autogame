# Independent Monster Cards

Implement Monster cards — they summon an AI-controlled allied minion that roams
the battlefield and fights enemies on its own. Depends on 010 and 011.

## Acceptance Criteria
- Using a Monster card spawns an allied minion entity owned by that player
- The minion is AI-controlled: it seeks out and attacks nearby enemies without
  player input, reusing the enemy-AI movement patterns from ticket 010
- The minion has its own `hp` and a limited lifetime; it despawns when either
  its `hp` reaches 0 or its duration expires
- Minions are rendered distinctly from both players and enemies, and are synced
  to all clients

## Technical Specs
- **Files**: `game/server/index.js`, `game/client/main.js`,
  `game/client/cards.js`
- **Server**: minion entities in game state `{ id, ownerId, x, z, hp, ttl }`;
  AI in the game loop that targets the nearest enemy; ownership and lifetime
  handling. Reuse the chase logic from ticket 010.
- **Client**: render minions with their own mesh pool, visually distinct.
