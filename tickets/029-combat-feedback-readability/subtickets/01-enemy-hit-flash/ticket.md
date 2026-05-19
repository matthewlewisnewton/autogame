# Enemy Hit Flash

When an enemy takes damage (from weapon, summon, or minion), flash the enemy mesh red/white briefly so the hit is visually obvious.

## Acceptance Criteria
- A `flashMesh(mesh, color, durationMs)` helper function exists in `game/client/main.js`.
- The helper temporarily changes a mesh's material emissive color, then restores it after the specified duration.
- Enemy meshes are flashed (red or white) whenever a `cardUsed` event arrives with `hits` containing that enemy's ID.
- The flash also triggers for minion damage: when `stateUpdate` shows an enemy's HP decreased since the last tick.

## Technical Specs
- **File:** `game/client/main.js`
  - Add `flashMesh(mesh, color, durationMs)` — sets `mesh.material.emissive` to the given color, `emissiveIntensity` to a high value (~1.5), then uses `setTimeout` to restore original emissive/intensity.
  - In the `cardUsed` socket handler, after spawning the attack/summon effect, iterate `data.hits` and call `flashMesh(enemiesMeshes[hit.enemyId], 0xffffff, 200)` for each hit enemy.
  - In the game loop (inside `animate`), track per-enemy previous HP; when `enemy.hp` drops compared to last frame and the damage didn't come from a `cardUsed` event (i.e., minion tick damage), flash the enemy mesh.
- **File:** `game/client/test/main.test.js`
  - Unit test that `flashMesh` exists and is callable with a mock mesh object (verifies emissive is set and restored via timer).

## Verification: code
