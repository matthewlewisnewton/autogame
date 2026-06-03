# Migrate client and server to `resolveFloorY`

Replace every inline `sampleFloorY` → Y fallback with the shared `resolveFloorY`
helper added in sub-ticket 01. After this pass, client and server must not use
divergent idioms (`?? DEFAULT_FLOOR_Y` vs `Number.isFinite(…) ? … : DEFAULT_FLOOR_Y`)
for floor sampling results.

## Acceptance Criteria

- Every server assignment of the form `player.y = Number.isFinite(floorY) ? floorY : DEFAULT_FLOOR_Y` (and the `plazaFloorY` / `plateauFloorY` / `bottomFloorY` variants) after a `sampleFloorY(…)` call uses `resolveFloorY(floorY)` instead, in `simulation.js`, `progression.js`, and `index.js` (including minion Y in `index.js`).
- Every client use of `sampleFloorY(…) ?? DEFAULT_FLOOR_Y` in production code uses `resolveFloorY(sampleFloorY(…))` instead, in `renderer.js` and `dungeon.js`.
- Test files that encode the old `??` or `Number.isFinite` fallback after `sampleFloorY` are updated to `resolveFloorY` (`applyPlayerMovement.test.js`, `dungeon.test.js` client).
- A repo search under `game/` finds no remaining `sampleFloorY(…) ?? DEFAULT_FLOOR_Y` and no remaining `Number.isFinite(.*FloorY)` ternaries tied to `sampleFloorY` results (other `?? DEFAULT_FLOOR_Y` uses unrelated to sampling, e.g. `savedData.y ?? DEFAULT_FLOOR_Y`, are left unchanged).
- `pnpm test:quick` passes from `game/`.

## Technical Specs

- **Imports**
  - Server files already import `sampleFloorY` and `DEFAULT_FLOOR_Y` from `./dungeon` or `../dungeon.js`; add `resolveFloorY` to those import lists.
  - Client `renderer.js` and `dungeon.js`: import `resolveFloorY` from `./collision.js` (or `../shared/floorSampling.esm.js` if that matches local style).
- **`game/server/simulation.js`** (~line 322–323): `player.y = resolveFloorY(sampleFloorY(_gameState.layout, result.x, result.z));` (drop the intermediate `floorY` variable if it becomes unused).
- **`game/server/progression.js`**: six sites (~1361, 1379, 2969, 3070, 3233, 3291) — same one-liner pattern.
- **`game/server/index.js`**: all `sampleFloorY` → entity Y assignments (~622, 664, 865, 889, 908, 931, 951, 3105, 3232) use `resolveFloorY`; do not change `player.y = savedData.y ?? DEFAULT_FLOOR_Y` (~1158).
- **`game/client/renderer.js`**: spawn Y (~893) and local avatar Y in the render loop (~3242) — e.g. `resolveFloorY(sampleFloorY(layout, myX, myZ))` when `layout` is present, else `DEFAULT_FLOOR_Y`.
- **`game/client/dungeon.js`**: treasure marker, wall base, and cover box floor Y (~241, 264, 291).
- **`game/server/test/applyPlayerMovement.test.js`**: player spawn `y` setup (~298).
- **`game/client/test/dungeon.test.js`**: treasure marker expectation (~448).

## Verification: code
