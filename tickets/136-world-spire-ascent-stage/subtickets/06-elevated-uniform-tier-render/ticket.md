# Elevated Uniform Tier Render

Fix the client dungeon renderer so spire tiers with uniform `floorCorners` (flat elevated platforms) draw at their real floor Y instead of the legacy constant `FLOOR_Y`, so the visible tower stacks above the ground plane.

## Acceptance Criteria

- In `buildDungeonMeshes`, when `isUniformFloor(room)` is true and `room.floorCorners` is present, the room floor mesh `position.y` equals the room's uniform corner Y (all four corners equal), not the global `FLOOR_Y` constant.
- Rooms without `floorCorners` (or at default height) still render at `FLOOR_Y` so existing flat dungeons are unchanged.
- The treasure-role marker cylinder on elevated treasure tiers sits on that tier's floor Y (e.g. `uniformY + 0.75`), not `FLOOR_Y + 0.75`.
- A unit test in `game/client/test/dungeon.test.js` builds a layout with one room at `floorCorners` Y `10.5` (uniform) and asserts the returned floor mesh `position.y` is `10.5` (or the project's visual offset convention if one is applied consistently to sloped floors).
- Existing client dungeon tests that cover legacy flat rooms at `FLOOR_Y` still pass.

## Technical Specs

- **Files:** `game/client/dungeon.js`, `game/client/test/dungeon.test.js`.
- **Helper:** Add a small exported helper (e.g. `uniformFloorY(room)`) that returns `room.floorCorners.yNW` when `isUniformFloor(room)` and corners exist, else `FLOOR_Y` (or `DEFAULT_FLOOR_Y` if that matches sloped-floor mesh convention — stay consistent with `buildSlopedFloor` / wall `sampleFloorY` usage).
- **Room loop (~line 221–236):** Replace `floorMesh.position.set(room.x, FLOOR_Y, room.z)` with the computed uniform Y for uniform floors; keep sloped branch unchanged.
- **Treasure marker:** Use the same uniform Y for marker base height.
- **Do not change** server layout generation, collision, or player movement — only client mesh placement.
- **Optional (only if spire uniform passages exist):** If any spire passage uses uniform elevated `floorCorners`, apply the same Y rule in the flat-passage branch (~line 282); skip if all spire connectors are sloped.

## Verification: code
