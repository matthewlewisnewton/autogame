# Client: Telegraph Visuals

Render visual telegraph cues on enemies when the server reports an `attackState` of `windup`, so players can anticipate incoming damage.

## Acceptance Criteria
- When an enemy's `attackState` is `windup`, the enemy mesh flashes a distinct color (e.g., bright red emissive pulse).
- A warning circle mesh appears on the ground at the target player's position, indicating the attack radius (`ENEMY_ATTACK_RANGE`).
- The warning circle and flash are removed when the enemy's `attackState` changes from `windup` to any other state.
- Telegraph visuals update every frame based on the latest `stateUpdate` from the server.

## Technical Specs
- **File:** `game/client/main.js`
  - Add a `telegraphMeshes` object (keyed by enemy id) to hold warning circle meshes.
  - In the `animate` loop, after processing `gameState.enemies`, iterate enemies and:
    - If `enemy.attackState === 'windup'` and no telegraph exists, create a red emissive ring mesh on the ground at the target player's position (look up `gameState.players[enemy.windupTargetId]`), and flash the enemy mesh red.
    - If `enemy.attackState !== 'windup'` and a telegraph exists, remove the ring mesh from scene and delete from `telegraphMeshes`.
  - Use `THREE.RingGeometry` (or `THREE.CircleGeometry`) for the warning circle, colored `0xff3333`, emissive, semi-transparent, lying flat on the ground (y ≈ 0.05).
  - Reuse the existing `flashMesh()` helper for the enemy color change during wind-up.
- **File:** `game/client/style.css` — no changes needed.
- **File:** `game/client/index.html` — no changes needed.

## Verification: code
