# Remove redundant dungeonMeshes reset in initScene

`clearDungeon(scene, dungeonMeshes)` already empties the `dungeonMeshes` array (`dungeonMeshes.length = 0`), so the immediately following `dungeonMeshes.length = 0` in `initScene()` is dead code. Remove it.

## Acceptance Criteria
- The redundant `dungeonMeshes.length = 0` line between `clearDungeon(scene, dungeonMeshes)` and `dungeonMeshes.push(...meshes)` in `initScene()` is removed.
- No other logic in `initScene()` is changed.
- Client tests still pass.

## Technical Specs
- **File**: `game/client/main.js`
- **Location**: `initScene()` function, around line 1695
- **Change**: Delete the single line `dungeonMeshes.length = 0;` that appears after `clearDungeon(scene, dungeonMeshes)` and before `dungeonMeshes.push(...meshes)`.

## Verification: code
