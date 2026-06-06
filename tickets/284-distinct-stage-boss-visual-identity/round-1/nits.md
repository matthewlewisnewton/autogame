## Refresh Enemy Mesh Helper Documentation

`createEnemyMesh()` still documents its `type` parameter as only `'grunt'`, `'skirmisher'`, `'miniboss'`, or `'spawner'`, but the renderer now intentionally supports the stage-boss keys `annex_overseer`, `arena_champion`, and `spire_warden` as first-class procedural visuals. Updating the JSDoc would make the supported surface clearer for future renderer work.

### Acceptance Criteria
- The `createEnemyMesh()` JSDoc lists or generically describes all supported enemy type keys, including the stage-boss keys.
