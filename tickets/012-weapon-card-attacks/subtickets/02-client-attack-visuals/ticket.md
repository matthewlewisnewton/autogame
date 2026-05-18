# Client-Side Attack Visual Effects

Render visible attack effects in the 3D scene when a Weapon card is used. On receiving the server's `cardUsed` broadcast, spawn a projectile or slash arc that travels from the attacker toward the direction of the attack and auto-removes after a short duration.

## Acceptance Criteria
- Client listens for the `cardUsed` socket event
- On receiving `cardUsed` for a weapon attack, a visual effect is spawned at the attacker's position and animates in the attack direction
- The effect is a simple 3D object (e.g., a small sphere moving forward, or a flat arc mesh that fades out) — it must be visible against the dark floor background
- The effect auto-removes from the scene after ~500–800ms so it doesn't persist or leak memory
- Effects from other players are also rendered (not just the local player's own attacks)
- If the attacker is the local player, the effect still renders (no skip)

## Technical Specs
- **Files**: `game/client/main.js`
- Add a `socket.on('cardUsed', handler)` listener
- The handler creates a temporary Three.js mesh (e.g., `SphereGeometry(0.3)` with a bright `MeshStandardMaterial` — yellow or white), positions it at the attack origin, and animates it forward along the direction vector over ~0.5 seconds
- Use a simple lerp or frame-based animation; remove the mesh from `scene` and dispose geometry/material after animation completes
- Store active effects in an array so multiple concurrent attacks don't interfere
- Read the attacker's position from `gameState.players[playerId]` or from the `origin` field in the `cardUsed` payload

## Verification: code
