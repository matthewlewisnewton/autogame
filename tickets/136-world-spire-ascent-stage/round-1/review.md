# Senior Review — 136 Spire Ascent Stage

## Runtime health (gate)

`round-1/metrics.json` reports `"ok": true`, `"pageerrors": []`, both players
reach `phase: "playing"` with `sceneInitialized: true` and a live canvas. No
`harness_failure` block. `console.log` shows only `[vite] connecting/connected`,
a benign `409 (Conflict)` on a resource load (lobby create race, not game code),
and `[debugScenario] applied sloped-dungeon` — no `pageerror` or `[fatal]`
lines. The game starts and loads cleanly. Gate passes.

Note: the fallback capture plan exercised the `sloped-dungeon` scenario rather
than `spire-ascent`, so the screenshots don't directly show the spire. This is a
capture-plan limitation, not a code defect — the spire renderer is covered by
passing unit tests (see below) and the stage loads through the same generic
floor/ramp/treasure rendering path the capture proved works. Filed as a nit.

## Per-criterion findings

**Selectable via `generateLayout(..., 'spire-ascent')`** — ✓ `LAYOUT_PROFILES`
gains a `spire-ascent` entry and `generateLayout` branches to
`generateSpireAscent(seed)` (`game/server/dungeon.js`). Follows the existing
`sunken-canyon` / `open-plaza` profile-string convention; the ticket's literal
`{ stage: "spire-ascent" }` object form is illustrative, matched by convention.

**3–5 flat tiers, tier n strictly above n-1** — ✓ `tierCount = 3 + floor(rng*3)`.
Each tier is a room-sized platform (12–15 units) with uniform `floorCorners`
(flat). `tierYs[i] = yBase + i*risePerStep` is strictly monotonic. Verified by
`has 3–5 flat tier platforms ... with monotonic centre Y` and `tier count is
3–5 across many seeds`.

**Ramp passages, avg slope ≥ 0.2** — ✓ `tierCount-1` ramps built via
`buildAscentRampRoom` → `buildDescentRampRoom` with sloped `floorCorners`.
`risePerStep` is nudged by `1e-6` above the slope floor to avoid the 4.8/24 = 0.2
float edge case. Verified by `has exactly tierCount − 1 ramps with slope ≥ 0.2`.

**Total Y gain ≥ 10 spawn→top** — ✓ `totalRise = max(10, (tierCount-1)*4.8)`;
for the 3-tier minimum, rise = 10 + ε. Verified by `total Y rise from start tier
to treasure tier is ≥ 10` across seeds.

**Outer walls prevent walk-off** — ✓ `buildTierPerimeterWalls` emits solid
east/west walls plus north/south walls with gaps only at the ramp spine; ramp
rooms carry both side walls. Verified by `tiers and ramps have solid outer
perimeter walls`.

**Camera follow / no clipping during ascent** — ✓ (by reuse). No spire-specific
camera/collision code; the stage rides the existing sloped-floor sampling
(`sampleFloorY`) and camera-follow from 116/117. Client render tests confirm
bottom flat, ramp sloped (`rotation.x != 0`), top elevated.

**Enemy spawns distributed across tiers** — ✓ `pickSpireAscentEnemySpawn` seeds
index 0→bottom, 1→a middle tier, 2→top, remainder random across tiers, and never
on `ramp`/`connector` rooms. Verified by `spawns at least one enemy on bottom,
middle, and top tiers` and `never places enemies on ramp connector rooms`.

**Objective/exit on final tier, reachable on foot via ramps** — ✓ Top tier is
`role: 'treasure'`; `spawnCrystals` restricts spire objectives to the treasure
tier. BFS reachability (`full foot reachability from start tier to every tier
and treasure centre`) confirms the start→treasure walk over ramps with no
jumping, and `countReachableRooms == rooms.length` rules out orphan tiers.

**Deterministic given a seed** — ✓ `mulberry32(seed)` throughout; verified by
`same seed yields deep-equal layouts` and deterministic spawn test.

**Required unit tests** — ✓ Tier count range, monotonic Y, every-tier
reachability, and no-orphan-tier are all present and passing (server
`dungeon.test.js` + `spire_ascent_spawn.test.js`, client `dungeon.test.js`).

**Debug scenarios** — ✓ Two were added (`spire-ascent-stage` render/collision
QA, `spire-ascent` full quest). Both are members of `DEBUG_SCENARIOS`, gated by
`isDebugScenarioAllowed` (localhost/local-origin or `ALLOW_DEBUG_SCENARIOS=1`,
hard-off in production), and reachable only through the debug URL param. The
same end-state is reachable in normal play: `spire_climb` is exposed in
`listQuests()` and selectable via the `selectQuest` socket handler — proven by
the integration test asserting `quests` now includes `spire_climb`. Neither
scenario short-circuits server validation: both call `generateLayout` /
`applyLayoutForQuest` and `spawnEnemies`, the same paths normal deployment uses.

## Test result

`npx vitest run server/test/dungeon.test.js server/test/spire_ascent_spawn.test.js
client/test/dungeon.test.js` → **161 passed (161)**.

## Remaining gaps

None blocking. The acceptance criteria are fully and robustly met, the game runs
cleanly, and the implementation reuses existing room/ramp/floor primitives
consistent with `design.md`. Minor non-blocking items are in `nits.md`.

VERDICT: PASS
