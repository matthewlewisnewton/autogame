# Enemy Health Bars

Add a small health bar above each enemy mesh so the player can tell how much HP an enemy has remaining.

## Acceptance Criteria
- Each enemy mesh has a corresponding health bar mesh (a thin box or plane) positioned above the enemy.
- Health bar width scales proportionally to `enemy.hp / maxHp` (max enemy HP is 50).
- Health bar color shifts from green → yellow → red as HP drops.
- When an enemy is removed from `gameState.enemies`, its health bar mesh is also removed.
- Health bars are created when enemy meshes are first created in the `animate` loop.

## Technical Specs
- **File:** `game/client/main.js`
  - Create a module-level `const enemyHealthBars = {};` map (enemy id → mesh).
  - When creating an enemy mesh in `animate`, also create a health bar: a small `BoxGeometry` (e.g., 1.2 × 0.1 × 0.1) positioned above the enemy at `y + 1.0`.
  - Each frame, update the health bar's scale.x to `enemy.hp / 50` and its material color based on HP percentage.
  - When cleaning up removed enemies, also remove and dispose the health bar mesh.
- **File:** `game/client/test/main.test.js`
  - Test that `enemyHealthBars` object exists and is populated when enemies are synced (via mock scene).

## Verification: code
