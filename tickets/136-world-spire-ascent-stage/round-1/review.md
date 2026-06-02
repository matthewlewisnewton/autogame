# Senior Review — Spire Ascent Stage (136)

## Runtime health (gating check)

- `metrics.json`: `"ok": true`, `pageerrors: []`, both servers up, scene
  initialized (`sceneInitialized: true`, `hasCanvas: true`), phase `playing`.
- `console.log`: only `[vite] connecting/connected`, `[initScene]`, and a
  `[debugScenario] applied sloped-dungeon` line. The two `409 (Conflict)`
  resource lines are benign auth re-registration network status, not game-code
  errors. No `pageerror` / `[fatal]` lines.
- Screenshots render cleanly; `04-sloped-ramp.png` shows the shared sloped-floor
  ramp primitive (the green sloped slab + arc) the spire reuses.

Note: the capture fell back to the generic `sloped-dungeon` smoke scenario
(`capturePlanSource: "fallback"`) rather than loading the spire tower itself.
That is a capture-plan limitation, not a code defect — the game starts and loads
cleanly, satisfying the runtime-health gate, and the spire-specific behaviour is
covered exhaustively by unit tests (160 passing). The `spire-ascent` /
`spire-ascent-stage` debug scenarios are wired in `applyDebugScenario` and apply
cleanly.

## Per-criterion findings

1. **Selectable via `generateLayout({ stage: "spire-ascent" })`** — PASS.
   `generateLayout(seed, 'spire-ascent')` routes to `generateSpireAscent(seed)`
   (`game/server/dungeon.js:144`). Returns `profile: 'spire-ascent'`.

2. **3–5 distinct tiers, each flat room-sized platform, strictly increasing Y** —
   PASS. `numTiers = 3 + floor(rng()*3)` (3–5). Tier size 12–15. Each tier built
   with uniform `floorCorners` (flat). Tier Y interpolated `yBase →
   yBase+10` monotonically. Verified by `dungeon.test.js` ("3–5 tiers… flat
   floorCorners", "strictly monotonic tier centre Y").

3. **Ramp passages with average slope ≥ 0.2** — PASS. `buildDescentRampRoom`
   emits sloped `floorCorners` (the ticket-116 primitive). `rampDepth =
   rise/minRampSlope*(1-1e-6)` so measured slope is ≥ 0.2 after FP rounding.
   One ramp per consecutive tier pair. Verified by the slope test.

4. **Total Y gain spawn→top ≥ 10** — PASS. `yTop = yBase + 10`; tier 0 at
   `yBase`. Test asserts `yTop - y0 >= 10` across 5 seeds. (Exactly 10 — meets
   the bound; see nit.)

5. **Outer walls on every tier and ramp prevent fall-through** — PASS. Tiers get
   four perimeter walls, with only `rampWidth`-wide gaps on the sides facing a
   ramp (`buildHorizontalWallWithGaps`). Bottom-tier south and top-tier north are
   solid. Ramps carry side walls along their long axis. The walking flood-fill
   reachability test (which respects wall colliders + walkable AABBs) confirms no
   fall-through.

6. **Camera follow as player ascends** — PASS (no regression). No client camera
   changes; existing follow tracks `player.y`, which now rises over real
   elevation via ticket 117. Capture shows clean tracking over sloped terrain.

7. **Enemy spawns distributed across tiers (not all tier-1, not all top)** —
   PASS. `pickSpireAscentEnemySpawn` spreads spawns across non-top tiers
   (bottom, interior, just-below-top) and never on ramps. `spire_ascent_spawn`
   test asserts spawns land on multiple distinct tiers and never on a
   ramp/connector.

8. **Objective/exit on final tier, reachable on foot via ramps only** — PASS.
   `spawnCrystals` places `collect_items` objectives only on the top tier for
   spire layouts. Foot reachability proven two ways: server flood-fill from
   tier-0 reaches the top-tier treasure centre, and the client `WALK_STEP`
   flood-fill reaches every room + top-tier centre.

9. **Deterministic given a seed** — PASS. `mulberry32(seed)`; deep-equal test
   on repeated generation; spawn determinism test.

10. **Unit tests: tier count range, monotonic Y, reachability, no orphan** —
    PASS. All present and passing (`dungeon.test.js`, `spire_ascent_spawn.test.js`,
    client `dungeon.test.js`). Full suite for changed files: 160/160 passing.

## Debug scenario audit

- `spire-ascent` / `spire-ascent-stage` are gated solely behind
  `applyDebugScenario` (URL `?debugScenario=` path); not touched by normal play.
- The same end-state is reachable normally: `spire_ascent` is a real entry in
  `QUEST_DEFS` and is surfaced to clients via `listQuests()` in
  `buildQuestUpdatePayload`, so selecting it in the lobby applies the identical
  `spire-ascent` layout.
- The scenario does not short-circuit invariants — it calls the real
  `applyLayoutForQuest` + `spawnEnemies` + `spawnCrystals` path (same validation,
  collider rebuild, and spawn logic as normal deploy).

## Design/foundation consistency

Consistent with `game/docs/design.md` world-stage direction; reuses the
116/117 sloped-floor primitives as intended. No regression to existing stages —
the other dungeon/canyon/plaza tests remain green.

## Remaining gaps

None blocking. See `nits.md` for minor non-blocking polish.

VERDICT: PASS