# Enemy Entities & Basic AI

Add server-spawned enemies that live in the world, wander, and chase nearby
players. This gives the combat tickets something to fight.

## Acceptance Criteria
- The server spawns and tracks enemy entities in `gameState.enemies`
- Enemies are rendered as distinct meshes (not player cubes — e.g. cones or
  spheres in a menacing colour) and appear for every connected client
- Enemies wander slowly when no player is near, and move toward the nearest
  player once that player is within a detection radius
- Enemy positions update every server tick and are broadcast to all clients
- Each enemy has `hp`; an enemy whose `hp` reaches 0 is removed from the world
  (the kill path may be triggered by a test hook until combat exists)

## Technical Specs
- **Files**: `game/server/index.js`, `game/client/main.js`
- **Server**: enemy objects `{ id, x, z, hp, state }`; an AI update step inside
  the existing game-loop `setInterval`. Keep the count modest (≈5 enemies) for
  performance.
- **Client**: render `gameState.enemies` with a mesh pool keyed by enemy id,
  mirroring how player meshes are managed; remove meshes for despawned enemies.
