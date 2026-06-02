# Senior Review — Spire Ascent Stage (136)

## Runtime health (gate)

The captured run is healthy:
- `round-2/metrics.json`: `"ok": true`, `"pageerrors": []`, no `harness_failure` block, both dev servers up (`url: http://localhost:5174/`).
- `round-2/console.log`: only benign `[vite] connecting/connected`, `[initScene]`, and successful `[debugScenario] applied sloped-dungeon` / `applied spire-ascent` lines. No `pageerror` / `[fatal]`.
- Probe shows `phase: "playing"`, `sceneInitialized: true`, `debugScenarioResult: { ok: true, scenario: "spire-ascent" }`, 6 enemies present.
- `04-spire-ascent.png` clearly shows the stacked-tier tower receding into the distance (multiple platforms ascending −Z); `04-sloped-ramp.png` shows the sloped ramp geometry.

Game starts and loads cleanly → gate passes.

I also ran the changed unit suites locally: `server/test/dungeon.test.js`, `server/test/spire_ascent_spawn.test.js`, `client/test/dungeon.test.js`, `client/test/renderer-camera-orbit.test.js` → **161 passed**.

## Per-criterion findings

1. **Stage variant selectable** — `generateLayout(seed, 'spire-ascent')` dispatches to `generateSpireAscent` (`game/server/dungeon.js:142`, `:835`). Profile registered in `LAYOUT_PROFILES` (`:82`) and quest `spire_ascent` wires `layoutProfile: 'spire-ascent'` (`game/server/quests.js`). The ticket's illustrative `{ stage: ... }` form is the positional profile string used by every sibling stage (open-plaza, sunken-canyon) — convention-consistent. **Met.**

2. **3–5 distinct tiers, each above the last** — `numTiers = 3 + floor(rng()*3)` ⇒ 3–5; `tierYs` strictly increasing by `risePerRamp`. Tier rooms are flat (`floorCorners` all = tier Y). Asserted across seeds (`dungeon.test.js:1471`, `:1489`). **Met.**

3. **Ramp passages, slope ≥ 0.2** — `buildDescentRampRoom` emits sloped `floorCorners`; `rampDepth = 6`, `risePerRamp = 10/numRamps` (2.5–5.0) ⇒ slope 0.42–0.83, always ≥ 0.2. Test `each ramp ... average slope ≥ 0.2` (`:1501`). **Met.**

4. **Total Y gain ≥ 10** — top tier Y = `DEFAULT_FLOOR_Y + minTotalRise (10)`; spawn at bottom = `DEFAULT_FLOOR_Y`. Test asserts `yTop - yStart >= 10` over 5 seeds (`:1513`). Exactly 10 at the boundary (see nits). **Met.**

5. **Outer walls on every tier and ramp, no fall-through** — tiers always get west/east z-walls (`:874`); non-connecting edges are solid, connecting edges use `buildHorizontalWallWithGaps` with a gap exactly = `rampWidth` aligned to the ramp at x=0; ramps get west/east walls flush with the tier gap edges. Test `solid outer perimeter` (`:1540`) plus the foot-reachability BFS (which would leak through any hole). **Met.**

6. **Camera follow tracks ascent** — local player mesh Y is set from `sampleFloorY(layout, myX, myZ)` each frame (`renderer.js:2725`) and fed to the now-exported `updateCameraOrbit` (`renderer.js:3043`), which lifts both camera and lookAt Y. `CAMERA_FAR` proven to exceed top-tier Y + margin (`renderer-camera-orbit.test.js:54`), so no clipping at the summit. **Met.**

7. **Enemies distributed across tiers** — `pickSpireAscentEnemySpawn` reserves one bottom slot, one top slot, then round-robins the remainder across middle tiers (`progression.js`). Never on ramp/connector rooms. Tests confirm "not all on bottom or top alone" and "never on ramp connectors". **Met.**

8. **Objective/exit on final tier, reachable on foot** — `spawnCrystals` and `spawnLoot` place on `tiers[last]` (top) for spire layouts; ramps form a continuous walkable chain. Foot-reachability test BFSes the walkable AABBs from spawn to the top tier across 5 seeds (`:1575`). **Met.**

9. **Deterministic** — pure `mulberry32(seed)`; `generateLayout(2024,...)` deep-equal test (`:1595`) and deterministic-spawn test. **Met.**

10. **Unit tests (tier count, monotonic Y, reachability, no orphans)** — all present and passing, including a stronger geometric foot-reachability check rather than just a ramp-graph check, and "no orphan tiers" over 30 seeds. **Met.**

## Debug scenarios

`spire-ascent` and `spire-ascent-stage` added to `DEBUG_SCENARIOS` (`index.js:429`) and handled in `applyDebugScenario`:
- URL param is the only entry point; gated behind the existing `debugScenarioAllowed` dev path. ✓
- `spire-ascent` sets `selectedQuestId = 'spire_ascent'`, calls `applyLayoutForQuest` + `spawnEnemies` — i.e. the identical state a player reaches by deploying the `spire_ascent` quest normally. The same end-state is reachable through real gameplay. ✓
- No server validation/persistence is short-circuited; it runs the normal layout + spawn path. ✓

Not a blocking shortcut.

## Consistency / regressions

- Existing profiles (default/crowded/open/open-plaza/sunken-canyon) are untouched — spire-ascent is an additive branch.
- `game/docs/design.md` does not enumerate stage variants, so no conflict.
- `buildDescentRampRoom` / `buildHorizontalWallWithGaps` are reused from the sunken-canyon work as the ticket recommended.

## Remaining gaps

None blocking. Minor polish noted in `nits.md`.

VERDICT: PASS
