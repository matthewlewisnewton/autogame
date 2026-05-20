# Client: mesh variants per type and per-enemy health bars

## Description

Render different Three.js meshes per enemy type on the client and use each enemy's `maxHp` (from server state) for health bar scaling instead of the global `ENEMY_MAX_HP = 50`.

## Acceptance Criteria

- Grunt enemies render as the existing red cone (`ConeGeometry(0.5, 1, 8)`, color `0xdc2626`).
- Skirmisher enemies render as a smaller, brighter mesh (e.g., `ConeGeometry(0.3, 0.6, 8)`, color `0xff6600` or similar orange).
- Miniboss enemies render as a larger, distinct mesh (e.g., `ConeGeometry(0.8, 1.8, 12)`, color `0x8800cc` or similar purple).
- Health bar width scaling uses `enemy.maxHp` (sent from server) instead of the hardcoded `ENEMY_MAX_HP = 50`.
- Health bar color thresholds (`healthBarColor`) use the ratio `enemy.hp / enemy.maxHp` so a miniboss at 75 HP shows 50% (yellow) not 150%.
- Existing windup flash (emissive red) still works on all mesh types.
- Telegraph warning circles still render during windup.

## Technical Specs

- **File**: `game/client/main.js`
  - Remove or repurpose the global `ENEMY_MAX_HP = 50` constant.
  - Add a `createEnemyMesh(type)` helper that returns a mesh based on type:
    ```js
    function createEnemyMesh(type) {
      switch (type) {
        case 'skirmisher': {
          const geo = new THREE.ConeGeometry(0.3, 0.6, 8);
          const mat = new THREE.MeshStandardMaterial({ color: 0xff6600 });
          return new THREE.Mesh(geo, mat);
        }
        case 'miniboss': {
          const geo = new THREE.ConeGeometry(0.8, 1.8, 12);
          const mat = new THREE.MeshStandardMaterial({ color: 0x8800cc });
          return new THREE.Mesh(geo, mat);
        }
        default: { // grunt
          const geo = new THREE.ConeGeometry(0.5, 1, 8);
          const mat = new THREE.MeshStandardMaterial({ color: 0xdc2626 });
          return new THREE.Mesh(geo, mat);
        }
      }
    }
    ```
  - In the enemy sync loop, replace mesh creation with `createEnemyMesh(enemy.type)`.
  - Set mesh y-position based on mesh height (half of cone height) so enemies sit on the ground.
  - Update `healthBarColor(hp, maxHp)` to accept maxHp and compute `pct = hp / maxHp`.
  - Update `updateHealthBarMesh(enemyId, enemy)` to use `enemy.maxHp` for ratio calculation and pass it to `healthBarColor`.
  - Ensure `createHealthBarMesh` positions health bars at the correct height per enemy type (e.g., `meshHeight + 0.5`).

## Verification: code
