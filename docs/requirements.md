# Game Requirements & Milestones

This file is the loop's source of truth. The **active milestone** is the only
thing the coder builds toward each round. The reviewer marks a milestone
complete and appends the next, small, incremental milestone — drawing scope
from `docs/design.md` (the overall vision).

---

## Active Milestone

### Milestone 1 — Foundation

1. **3D Graphics Engine**: The game renders a 3D scene (Three.js or similar)
   with no runtime errors and a non-blank canvas.
2. **Server-Client Architecture**: The frontend connects to the backend over
   WebSockets and shows a clear "Connected" status.
3. **Multiplayer Visualization**: Every connected player is represented as a
   distinct object in the 3D space; a second client appears to the first.
4. **Movement Synchronization**: WASD updates the local player's position and
   broadcasts it to the server, so other clients see the movement.

---

## Completed Milestones

_(none yet)_
