# Senior Review — Spire Ascent Stage (136)

## Runtime health (gate)

The captured run is healthy:
- `metrics.json` → `"ok": true`, `pageerrors: []`, no `harness_failure` block.
- `console.log` has no `pageerror`, `[fatal]`, or uncaught-exception lines.
- Screenshots (`02-after-w.png`, `04-sloped-ramp.png`) show the game running:
  HUD, hand, enemies, and sloped floor geometry all render correctly.

Note: the browser capture fell back to the generic `sloped-dungeon` scenario
(`capturePlanSource: "fallback"`, `scenarios: ["sloped-dungeon"]`) rather than
exercising the `spire-ascent` debug scenario directly, so there is no in-browser
screenshot of the spire stage itself. This is a capture-plan limitation, not a
code defect — the spire rendering path is covered by passing client unit tests
(`game/client/test/dungeon.test.js`, including a server-generated spire layout).
Filed as a nit.

## Per-criterion findings

**New stage variant selectable from generateLayout.** ✓ `generateLayout(seed,
'spire-ascent')` dispatches to `generateSpireAscent` (`game/server/dungeon.js:141`),
following the existing profile convention (open-plaza, sunken-canyon). The
`spire_ascent` quest wires the profile in (`game/server/quests.js`) and appears
in `listQuests()`, so it is reachable through normal quest selection — confirmed
by the integration test asserting `quests` includes `spire_ascent`.

**3–5 flat tiers, monotonic Y.** ✓ `numTiers = 3 + floor(rng()*3)`; each tier has
uniform `floorCorners`. Tested for tier count in [3,5] across 30 seeds and
strictly increasing per-tier Y across multiple seeds.

**Ramp passages, slope ≥ 0.2.** ✓ `buildDescentRampRoom` emits sloped
`floorCorners`; `risePerRamp` is floored at `minSlope * rampDepth = 0.2*20`.
Tested: every ramp has non-uniform corners and average slope ≥ 0.2.

**Total Y gain ≥ 10.** ✓ `totalRise = max(yGainTotal=10, minTotalRise)`. Tested
bottom→top center Y delta ≥ 10 across 5 seeds.

**Outer walls prevent fall-through.** ✓ Each tier gets west/east full walls plus
solid south (bottom) / north (top) edges; intermediate edges use
`buildHorizontalWallWithGaps` leaving only the ramp-width gap. Ramps get side
walls. Tested perimeter walls present; full walkable-grid reachability confirms
no fall-through gaps.

**Camera follow / no clipping on ascent.** ✓ (indirect) Player Y is set via
`sampleFloorY` on spawn and during movement (shared 116/117 floor sampling).
Game runs cleanly with sloped geometry; no console clipping errors. Spire-specific
follow not directly captured (see capture nit) but uses the same shared
follow/sampling code already proven on sloped floors.

**Enemy spawns distributed across tiers.** ✓ `pickSpireAscentEnemySpawn` +
`buildSpireAscentTierSpawnPlan` guarantee ≥1 bottom-tier enemy and ≥1 upper-tier
enemy, never on ramp/connector rooms. Tested directly with the 6-enemy quest.

**Objective/exit on final tier, reachable on foot via ramps.** ✓ Crystals and
loot placed only on top-tier rooms (`spireAscentTopTierRooms`). Tested:
crystals land on the max tier index, and a BFS over the walkable grid confirms
the bottom-tier center can reach the top-tier center on foot.

**Deterministic given a seed.** ✓ Mulberry32-seeded; tested deep-equal for
repeated generation and identical enemy placement across resets.

**Unit tests: tier count, monotonic Y, reachability, no orphan.** ✓ All present
and passing, plus extras (roles, perimeter walls, render mesh counts).

## Quality / debug-scenario checks

- Debug scenarios `spire-ascent` and `spire-ascent-stage` are gated behind the
  `DEBUG_SCENARIOS` allowlist and only entered via `applyDebugScenario` (URL
  param). The end state is independently reachable through normal play (the
  `spire_ascent` quest). Neither scenario short-circuits invariants: `spire-ascent`
  runs the same `applyLayoutForQuest` + `spawnEnemies` as a normal deploy;
  `spire-ascent-stage` is a pure render/collision QA load mirroring the existing
  `sunken-canyon-stage` pattern.
- Full test run is green: 650 tests across the affected suites pass.
- Code reuses existing primitives (`buildDescentRampRoom`,
  `buildHorizontalWallWithGaps`) cleanly; no dead/broken code spotted.

## Remaining gaps

None blocking. The browser capture not exercising the spire scenario directly is
a capture-plan nit (logged in nits.md), not a defect — the runtime gate passes
and the spire behavior is robustly unit-tested.

VERDICT: PASS
