# Review: Spire Ascent Stage

## Runtime Health

- **FAIL:** the captured run is not healthy. `metrics.json` has `"ok": false` with `failure_kind: "capture_failed"`, and `console.log` shows browser requests to `/api/register` and `/api/login` returning `502 Bad Gateway`.
- `pageerrors.json` is empty and there are no browser `pageerror` or `[fatal]` lines, so this is not a module-load crash. The client log shows Vite proxy `ECONNREFUSED` for `/api/*` while the server log says `Server listening on port 3001`; the live `game/client/vite.config.js` proxy is hard-coded to `http://localhost:3000`.
- Because the game did not load cleanly in the captured run, the ticket cannot pass regardless of the code shape.

## Acceptance Criteria Findings

- **Selectable stage variant:** implemented in the live code via `generateLayout(seed, profile, { stage: 'spire-ascent' })` and wired through the `spire_ascent` quest with `layoutStage: 'spire-ascent'`.
- **3-5 monotonic tiers:** implemented. The generated spire layout creates flat tier rooms with `tierIndex` and strictly increasing `tierBaseY`. For the selected `spire_ascent` seed, the layout has 5 tiers from `y=0.5` through `y=10.5`.
- **Sloped ramp passages:** implemented structurally. Ramp passages carry `floorCorners`, slab bounds, side walls, and slopes above the required `0.2`; the selected quest seed has ramp slopes around `0.36-0.50`.
- **Total Y gain >= 10:** implemented. The selected quest seed gains exactly 10 units from bottom to top.
- **Outer walls / no fall-through:** implemented in layout data for tier perimeters and ramp side walls, and server/client walkable AABB handling uses passage slab bounds.
- **Camera and visible vertical ascent:** **blocking gap.** Server-side player/enemy Y sampling follows elevated tier heights, but `buildDungeon()` renders every uniform flat room floor at the constant `FLOOR_Y`. Spire tier floors are uniform, so the upper platforms render at ground level while walls, player Y, camera, and sloped ramps use elevated values. This fails the visible stacked-tier requirement and risks obvious floating/clipping during ascent.
- **Enemy spawns distributed across tiers:** partially implemented for the selected quest seed; eight enemies are planned across combat tiers 1, 2, and 3. However, the final tier is marked `treasure` and excluded from combat spawning.
- **Objective / exit on final tier:** **blocking gap.** The `spire_ascent` quest is still a `defeat_enemies` objective, and all required enemies spawn below the final tier. The top-tier treasure marker is visual-only and is rendered at the low default marker height, so a player can complete the run without reaching the final tier. The ticket requires the final tier to hold the objective / exit.
- **Determinism:** implemented for layout and quest seed usage.
- **Unit tests:** the ticket adds focused coverage for tier count, monotonic Y, ramp geometry, graph reachability, quest wiring, walkable AABBs, and enemy tier distribution. `coverage.log` reports `38` test files and `1124` tests passing.

## Design / Requirements Consistency

The server-side layout model is consistent with the design document's sloped-floor model: walkable Y comes from `sampleFloorY()` over room and passage `floorCorners`, and player movement updates `player.y` accordingly. The implementation does not regress the basic server/client/movement requirements in code or unit tests, but the captured run failure means the end-to-end requirements are not proven in this round.

## Debug Scenarios

The ticket adds `spire-ascent-ready`. It is gated by the existing debug-scenario path (`debugScenario` socket handling is denied in production/non-local contexts unless explicitly enabled), and normal gameplay can still select `spire_ascent` through `selectQuest` and ready up. The scenario does not appear to be the only way to reach the spire state, but the capture did not reach gameplay, so it did not provide visual proof.

## Remaining gaps

1. Captured game run did not load: `metrics.json` has `"ok": false` / `capture_failed`, and `console.log` shows `502` for `/api/register` and `/api/login`.
   Files: `game/client/vite.config.js`, `game/server/index.js`
   Fix: make the Vite proxy target the actual backend port used by the harness (server listened on `3001` in this capture), then rerun capture until `metrics.json` is healthy.

2. Elevated spire tiers are not rendered at their server-side heights because uniform room floors always use `FLOOR_Y`.
   Files: `game/client/dungeon.js`
   Fix: render uniform elevated room floors and treasure markers at the room's `floorCorners`/sampled height using the same elevation convention as sloped floors; add a client test for an elevated flat tier.

3. The final tier is not a required objective or exit; `spire_ascent` is `defeat_enemies`, enemies spawn only on lower combat tiers, and the top-tier marker is visual-only.
   Files: `game/server/quests.js`, `game/server/progression.js`, `game/server/dungeon.js`, `game/client/dungeon.js`
   Fix: put an actual required objective/exit on the final tier (for example a final-tier collectable or exit trigger) and gate run completion on reaching/completing it while preserving enemy distribution along the climb.

VERDICT: FAIL
