# Senior Review — Spire Ascent Stage (136)

## Runtime health
`round-1/metrics.json`: `"ok": true`, `pageerrors: []`, no `harness_failure`
block, both players reached `phase: "playing"` with an initialized scene and a
live canvas. `console.log` shows only benign noise (a 409 on a resource fetch
and `[vite] connecting/connected`), the scene init lines, and a successful
`[debugScenario] applied sloped-dungeon`. No uncaught page errors or `[fatal]`
lines from game code. **The game starts and loads cleanly.**

Note: the capture fell back to the generic `sloped-dungeon` scenario
(`capturePlanSource: "fallback"`, `scenarios: ["sloped-dungeon"]`), so the
screenshots do not actually frame the new spire geometry. That is a
capture-plan limitation, not a code defect — the run is still valid runtime
proof, and the spire layout is exhaustively exercised by unit tests (see below).
Logged as a nit.

## Per-criterion findings

1. **Selectable via generateLayout** — PASS. `generateLayout(seed, 'spire-ascent')`
   routes to `generateSpireAscent(seed)` (`game/server/dungeon.js:144`). The AC's
   `{ stage: ... }` wording is illustrative; the positional `(seed, profile)` form
   matches the established convention used by `open-plaza` and `sunken-canyon`.

2. **3–5 flat tier rooms, tier n strictly above n-1** — PASS. `tierCount` is
   `3 + floor(rng()*3)` ∈ [3,5]; each tier gets `floorCorners` all equal to
   `yBottom + i*yStep` (flat) and Y strictly increases with `i`. Tests:
   "has 3–5 flat tier rooms", "tier floor Y strictly increases", "tier count 3–5
   across 40 seeds".

3. **Ramp passages, avg slope ≥ 0.2** — PASS. One `buildDescentRampRoom` per
   consecutive tier pair, `rise = yStep = 10/(tierCount-1)`, `run = rampDepth = 12`,
   giving slope 0.208 (5 tiers) … 0.417 (3 tiers), always ≥ 0.2. Test asserts
   `rampAverageSlope ≥ 0.2` and non-uniform corners for every ramp.

4. **Total Y gain ≥ 10** — PASS. Top tier sits at `yBottom + 10`. Test
   "Y gain from start tier centre to treasure tier centre is ≥ 10" across 5 seeds.

5. **Outer walls on every tier and ramp (no fall-through)** — PASS. Tiers get
   solid west/east walls always; north/south edges are solid on the extremes and
   gapped only at the centre ramp opening (`buildHorizontalWallWithGaps`, gap width
   = `rampWidth`, centred at x=0). Ramps carry side walls at x±rampWidth/2 from
   `buildDescentRampRoom`, which exactly align with the tier gap edges — the seam
   is closed. Tests verify perimeter walls and that ramps carry ≥ 2 walls;
   flood-fill reachability tests confirm no walk-off escape.

6. **Camera follow / no clipping** — PASS (by construction + collision sim).
   Floor Y is seamless at every seam (tier `y` == ramp low corner; ramp high
   corner == next tier `y`), so `sampleFloorY` is continuous along the climb.
   `applyDebugScenario` snaps `player.y` to `sampleFloorY` at spawn. Walkable-AABB
   flood-fill from spawn to the treasure tier succeeds, indicating no
   stuck-below-floor dead ends.

7. **Enemy spawns distributed across tiers** — PASS. `pickSpireAscentEnemySpawn`
   quota-fills bottom → first-middle → top, then round-robins the full tier cycle;
   ramps (spawnWeight 0) are excluded. Test "distributes enemies across bottom,
   middle, and top tiers" and "never places enemies on ramp connector rooms".

8. **Objective/exit on final tier, reachable on foot via ramps only** — PASS.
   The `spire_ascent` quest is `defeat_enemies` with enemies on every tier
   including the top, plus crystals/loot placed exclusively on the treasure tier
   (`spawnCrystals`/`spawnLoot` gated on `isSpireAscentLayout`). Tiers are linearly
   stacked at x=0 and joined by ramps with ≥0.2 slope — reachable on foot, no jump.
   Foot-reachability test from start to treasure passes across 4 seeds.

9. **Deterministic given a seed** — PASS. Single `mulberry32(seed)` stream;
   "same seed yields deep-equal layouts" tests pass.

10. **Unit tests (tier count, monotonic Y, reachability, no orphan)** — PASS.
    164 tests across the four added/changed suites pass; all four required
    coverages are present, including `countReachableRooms == rooms.length`
    (covers "no orphan tier" — every tier *and* ramp is reachable).

## Debug scenarios
Two were added — both correctly gated behind `isDebugScenarioAllowed(socket)`
(the URL/socket path is the only entry point):
- `spire-ascent-stage` — layout/collision QA shortcut (sets the spire layout,
  no quest state). Pure render QA.
- `spire-ascent` — sets `selectedQuestId='spire_ascent'` and calls
  `applyLayoutForQuest(state, 'spire_ascent')`, i.e. the *same* code path a normal
  deploy takes; it then re-spawns enemies. It does not skip validation,
  persistence, or replication that normal play exercises.
The equivalent end-state is reachable in normal play: `spire_ascent` is in
`QUEST_DEFS` and surfaced to clients through `listQuests()` /
`buildQuestUpdatePayload`, exactly like `canyon_descent`. Normal path confirmed.

## Consistency / regression
Mirrors the existing `sunken-canyon` stage structure (band-tagged rooms, empty
`passages`, connector ramps, role-gated spawn/loot/crystal helpers). No changes
to shared flat-layout behavior; existing dungeon/integration/server tests still
pass. Consistent with `design.md` height-gain goals (116/117 sloped-floor work).

## Remaining gaps
None blocking. One nit (capture used the `sloped-dungeon` fallback rather than a
spire scenario, so screenshots don't show the new geometry) is recorded in
`nits.md`.

VERDICT: PASS
