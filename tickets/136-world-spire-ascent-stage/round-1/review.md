# Senior Review — 136 Spire Ascent Stage

## Runtime health (gating)

`metrics.json`: `ok: true`, `pageerrors: []`, both players reached
`phase: "playing"`, scene initialized, canvas present. `console.log` contains
only two benign `409 (Conflict)` resource lines (auth re-use during the
two-client smoke), no `pageerror` / `[fatal]` lines. `pageerrors.json` is `[]`.
Screenshots render cleanly — HUD, floor, ramp geometry, cards, enemies all
visible; no black frame or clipping. **The game starts and loads cleanly.**

Caveat (non-blocking): the capture used the **fallback** plan with the
`sloped-dungeon` scenario, not the new `spire-ascent` scenario, so this round
produced no screenshot of the tower itself. That is a capture-plan limitation,
not a code defect — the spire rendering is exercised by the client unit tests
and was already visually QA'd in sub-ticket 02. Logged as a nit.

## Per-criterion findings

1. **Selectable via `generateLayout({ stage: "spire-ascent" })`** — PASS.
   `generateLayout` branches to `generateSpireAscent(seed)` for profile
   `'spire-ascent'` (dungeon.js:142). Exported and registered.

2. **3–5 tiers, each flat room-sized platform, tier n strictly above n-1** —
   PASS. `tierCount = 3 + floor(rng()*3)` → 3–5. Each tier gets flat
   `floorCorners` at `y = DEFAULT_FLOOR_Y + i*yStep`; width/depth in 12–15.
   Tests assert count range, flatness, and strictly-increasing `sampleFloorY`
   per `tierIndex` across seeds.

3. **Ramp passages with sloped `floorCorners`, avg slope ≥ 0.2** — PASS. Each
   step uses `buildDescentRampRoom` (the ticket-116 helper, axis `'z'`). Slope =
   `(10/(tierCount-1))/8` → 0.31–0.63 for all valid tier counts; a runtime guard
   throws if it ever drops below 0.2. Tests assert non-uniform corners and
   slope ≥ 0.2.

4. **Total Y gain spawn→top ≥ 10** — PASS. Top tier `y = DEFAULT_FLOOR_Y + 10`;
   gain is exactly 10 (meets ≥10). Verified by test across 5 seeds.

5. **Walls prevent walk-off on every tier and ramp** — PASS. Tiers get full
   west/east walls plus north/south walls with only a ramp-width gap where a
   ramp connects (`buildHorizontalWallWithGaps`); the bottom tier's south and
   the top tier's north are solid. Ramps carry both long-side walls. Verified
   the tier-north-edge / ramp-south-edge boundaries are coincident and at equal
   Y, so the walkable surface is continuous with no fall-through seam. Tests
   assert solid exterior walls and 2 long-side ramp walls.

6. **Camera follows the player up the spire** — PASS. `updateCameraOrbit` keys
   orbit height and lookAt off the local avatar Y (sampled on slopes; server
   keeps `player.y` in sync), with an explicit comment that pinning to
   `DEFAULT_FLOOR_Y` would strand the camera on ramps. Sub-ticket 02 QA'd this.

7. **Enemy spawns distributed across tiers** — PASS.
   `pickSpireAscentEnemySpawn` forces ≥1 bottom and ≥1 top, fills the rest from
   middle+bottom, and never targets ramp/connector rooms. Test asserts ≥1 on
   tier 0, ≥1 on max tier, and neither holds all enemies; another test asserts
   no enemy lands on a connector.

8. **Objective/exit on final tier, reachable on foot via ramps** — PASS.
   `spawnCrystals` and `spawnLoot` place objectives on the top-tier rooms.
   Reachability is proven two ways: a BFS over the real wall colliders +
   walkable AABBs from the start room to the treasure centre (4 seeds), and a
   full-room reachability count (`countReachableRooms === rooms.length`) over
   30 seeds. No jumping required — the climb is via the continuous ramps.

9. **Deterministic given a seed** — PASS. Pure `mulberry32(seed)`; test asserts
   deep-equal layouts and identical enemy spawn positions for a fixed seed.

10. **Unit tests (tier count, monotonic Y, reachability, no orphan)** — PASS.
    All four required properties covered, plus slope, rise, walls, roles, and
    determinism. 163 tests across the three suites pass locally.

## Integration / cross-cutting

- **Reachable in normal play, not just via the debug URL.** The `spire_ascent`
  quest is registered in `QUEST_DEFS` and surfaced by `listQuests()`, so a
  player can select it from the lobby; `applyLayoutForQuest` loads the
  `spire-ascent` profile. The end-state is not gated behind the debug shortcut.
- **Debug scenarios properly gated.** Both `spire-ascent` and
  `spire-ascent-stage` live only in `DEBUG_SCENARIOS` / `applyDebugScenario`
  (the `?debugScenario=` path). The `spire-ascent` scenario runs the *real*
  `applyLayoutForQuest` + `spawnEnemies` — same path as normal deploy, no
  skipped validation or replication; it only tops up HP/MS for QA convenience.
  `spire-ascent-stage` is a layout-only render/collision QA load whose
  equivalent state is reachable normally via the quest. Invariants intact.
- **No design.md/requirements regression.** design.md does not enumerate stages
  or layout profiles, so there is nothing to contradict; the existing
  crowded/open-plaza/sunken-canyon paths are untouched.

## Remaining gaps

None blocking. Minor non-blocking items recorded in `nits.md`.

VERDICT: PASS
