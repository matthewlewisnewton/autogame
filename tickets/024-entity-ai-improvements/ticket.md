# Entity AI Improvements

Audit and improve the AI for both enemy entities and summoned allied monsters. The current implementation in `game/server/index.js` relies on simple direct-vector movement (`dx/dist * move`) and entirely ignores dungeon wall collisions. This allows entities to walk straight through geometry, and causes enemies to pick invalid wander targets (`randomWanderTarget`) that may be out of bounds.

## Acceptance Criteria
- **Collision Awareness**: AI movement must be validated against `gameState.layout` walls. Entities should no longer clip through map geometry to reach a target.
- **Enemy AI**: 
  - Fix `randomWanderTarget` so it only selects coordinates that are inside valid generated rooms or passages, rather than a hardcoded `[-20, 20]` area.
  - Enemies should not become permanently stuck when trying to walk through a wall to reach the player.
- **Allied Monster AI**: 
  - Summoned minions currently stand entirely stationary when no enemies are in range (`updateMinions` lines 549). Update them to actively follow their owner when out of combat.
  - Ensure minions also respect wall collisions so they don't get trapped in a room behind the player.

## Potential Solutions

### Solution 1: Wall-Sliding / Raycast Steering (Recommended)
*   **Description:** Inject a collision check into the tick loops (`updateEnemies`, `updateMinions`). If the intended movement vector intersects a wall segment, zero out the blocked axis and allow the entity to slide along the unblocked axis (often called "wall sliding").
*   **Pros:** Very performant; avoids the heavy CPU cost of full server-side navigation meshes; fits the fast-paced, direct movement of an action RPG.
*   **Cons:** Entities can still get caught in deep "U" shaped dead ends, though the current procedural room layout makes this rare.

### Solution 2: Grid-Based Pathfinding (A*)
*   **Description:** Translate the 2D layout grid used during generation into a navigation grid. When an AI chases a player or follows an owner, it runs an A* search from its current cell to the target cell to generate a sequence of waypoints.
*   **Pros:** Entities will intelligently navigate through tight corridors and doors perfectly, completely eliminating the "stuck on wall" problem.
*   **Cons:** Computationally expensive to run A* on the server for multiple entities every tick. Requires throttling path recalculations (e.g., only updating the path every 0.5s or 1s) to save CPU.

### Solution 3: Flow Fields (Vector Fields)
*   **Description:** Rather than calculating paths per entity, the server periodically generates a flow field where every walkable cell points in the direction of the nearest player. Enemies just sample the vector at their current position.
*   **Pros:** Incredible performance for massive swarms of enemies (hundreds of entities) since the pathfinding cost is shared.
*   **Cons:** Over-engineered for small groups (5-10 enemies). Very difficult to adapt for allied minions, since each minion has a different distinct target (its specific owner or nearest enemy), requiring multiple separate flow fields.

## Technical Specs
- **Files to modify**: `game/server/index.js` (`updateEnemies`, `updateMinions`, `randomWanderTarget`, and any needed collision utility functions).
