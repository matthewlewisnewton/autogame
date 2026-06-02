# Server: Sunken Canyon layout generator

Add a `sunken-canyon` layout profile to `generateLayout()` that builds an elevated
plateau (spawn), a large lower canyon floor (≥ 4× a default room), and 2–3
descending ramp rooms with sloped `floorCorners`. Export a reusable ramp helper
for the future spire stage (136). Wire a quest and dev scenario so the layout is
loadable in a running session.

## Acceptance Criteria

- `generateLayout(seed, 'sunken-canyon')` returns a layout with `profile:
  'sunken-canyon'` (project convention for `{ stage: "sunken-canyon" }`).
- Layout defines exactly **two elevation bands** via room metadata:
  - **Plateau** — one room-sized platform (`band: 'plateau'`), flat
    `floorCorners` at the upper Y.
  - **Canyon** — one large walkable room (`band: 'canyon'`) with area ≥
    4× a default room (~13.5 × 13.5 ≈ 182 units² ⇒ canyon area ≥ 728 units²).
- **2–3 ramp rooms** (`band: 'ramp'`) connect plateau → canyon. Each ramp:
  - Uses sloped `floorCorners` (high edge meets plateau Y, low edge meets canyon Y),
  - Has average slope (ΔY / horizontal run along the descent axis) ≥ 0.15,
  - Is foot-reachable from plateau to canyon (no cliff-only gap between bands).
- Total Y drop from plateau spawn (`firstRoomPosition` on plateau) to canyon
  center ≥ 8 units (`sampleFloorY` at those points).
- **Perimeter walls** on plateau and canyon enclose walkable areas; ramp mouths
  align with wall gaps so bands connect. No walk-off-the-map holes between bands.
- **Vista edge**: the plateau side facing the canyon uses low parapet walls
  (height ≤ 1.5 units) or omits wall segments above each ramp mouth so a player
  at spawn can see down into the canyon (no full `WALL_HEIGHT` barrier blocking
  the view).
- `assignRoomRoles()` marks plateau as `'start'`, canyon as `'treasure'` (farthest
  reachable band), ramps as `'combat'` or neutral with `spawnWeight: 0`.
- `layout.stageMeta` documents `{ plateauRoomIndex, canyonRoomIndex, rampRoomIndices }`
  for downstream spawn logic.
- Deterministic: two calls with the same seed yield deep-equal layouts.
- Quest `sunken_canyon` in `quests.js` with `layoutProfile: 'sunken-canyon'`.
- Dev emit scenario `sunken-canyon-stage` in `index.js` (mirror `open-plaza-arena`):
  selects the quest, regenerates layout, places the player on the plateau spawn.
- Unit tests in `dungeon.test.js` cover: two bands present, 2–3 ramps, plateau Y
  − canyon Y ≥ 8, per-ramp slope ≥ 0.15, BFS reachability from plateau to canyon,
  perimeter closure (no missing outer wall on plateau/canyon), determinism.

## Technical Specs

- `game/server/dungeon.js`:
  - Add `'sunken-canyon'` to `LAYOUT_PROFILES` and branch in `generateLayout()` to
    `generateSunkenCanyon(seed)`.
  - **`createDescendingRampRoom(opts)`** — shared helper taking
    `{ x, z, width, depth, yHigh, yLow, axis }` (`'z'` = descend along +Z) and
    returning a room object with correct `floorCorners` and thin side walls.
    Export it for ticket 136. Add **`averageRampSlope(room)`** helper used by tests.
  - **`generateSunkenCanyon(seed)`** — deterministic placement using `mulberry32`:
    plateau ~14×14 at elevated Y (e.g. `yPlateau = 9`), canyon ~32×32 (or larger)
    offset below at `yCanyon = yPlateau - drop` with `drop ≥ 8`, 2–3 ramp rooms
    bridging the vertical gap with passages/adjacency so BFS from start reaches
    canyon. Tag each room with `band`.
  - Reuse existing wall segment helpers (`axis: 'x'|'z'`, gap for passages) from
    room generation; parapet walls use a documented reduced height constant.
  - Call `assignRoomRoles(layout)` before return.
- `game/server/quests.js`: add `sunken_canyon` quest def (`defeat_enemies`, modest
  `enemyCount` for smoke testing).
- `game/server/index.js`: add `sunken-canyon-stage` to `SCENARIO_NAMES` and a
  handler that sets `selectedQuestId`, calls `applyLayoutForQuest`, and snaps the
  player to `firstRoomPosition()` with `player.y = sampleFloorY(...)`.
- `game/server/test/dungeon.test.js`: new `describe("generateLayout(seed, 'sunken-canyon')")`
  block with the assertions listed above.

## Verification: code
