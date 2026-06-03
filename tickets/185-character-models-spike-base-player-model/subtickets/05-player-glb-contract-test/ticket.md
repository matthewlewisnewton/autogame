# Automated `player.glb` contract test

Add a client unit test that loads the committed `player.glb` and asserts the
spike contract from `MODEL_SPIKE.md` — morph names, bounding dimensions, and basic
parse health — so regressions are caught without manual Blender inspection.

## Acceptance Criteria

- A vitest under `game/client/test/` loads `/models/player.glb` (via `loadModel` or
  `GLTFLoader` in jsdom/node test environment) and passes in `pnpm test:quick`.
- Test asserts all six morph-target names exist on the exported mesh:
  `height`, `headSize`, `torsoWidth`, `armLength`, `legLength`, `shoulderWidth`.
- Test asserts the axis-aligned bounding box height is **1.7–1.9** world units and
  the box minimum **y ≥ −0.05** (feet on ground).
- Test asserts triangle count is **≤** the poly budget documented in `DECISION.md`
  (read budget from doc constant in test or a single shared `MAX_PLAYER_TRIS`
  number duplicated in `MODEL_SPIKE.md`).
- Failure messages name the missing morph or violated dimension for quick fixes.

## Technical Specs

- **Create** `game/client/test/playerModel.test.js` (or similar) using existing
  vitest + Three.js test patterns from `game/client/test/`.
- Reuse `loadModel` from `game/client/models.js` where practical; traverse the
  loaded scene for `mesh.morphTargetDictionary` / influences.
- Compute bounds with `THREE.Box3().setFromObject(scene)` after load.
- Do **not** enable registry rendering or change gameplay files.

## Verification: code
