# Senior Review — Spire Ascent Stage (136)

## Runtime health — FAILED (no runnable proof)

`round-1/metrics.json` reports `"ok": false` with `failure_kind: "capture_failed"`.
The capture's `page.waitForFunction` timed out after 12s and the browser never
reached a playable state. Per the runtime-health gate this is an automatic
`VERDICT: FAIL`: we have no captured proof the game runs with this ticket
applied.

However — this is an **infrastructure / capture failure, not a code defect**:

- `pageerrors.json` is `[]` and `metrics.json` `pageerrors` is empty — there are
  **no uncaught browser exceptions**. `failure_kind` is `capture_failed`, not
  `browser_pageerror`.
- `server.log` shows the server **started cleanly**: `Server listening on port
  3001`, `[persistence] FileProvider initialized`, `Player connected`. No stack
  trace, no `[fatal]`, no game-code error.
- `client.log` is full of `vite http proxy error … AggregateError [ECONNREFUSED]`
  against `/api/login` and `/socket.io/...`, and `console.log` shows repeated
  `502 (Bad Gateway)` from the Vite proxy. These mean the client could not reach
  the upstream server on `:3001`.
- `capture_diagnosis.port_holders` shows **`"3001": []`** at diagnosis time — the
  server process was already gone, so the proxy had nothing to forward to. The
  diagnosis `detected` list is empty (no known infra signature matched), so no
  `harness_failure` block was written, but the symptom set (server up in its own
  log, then vacated; client ECONNREFUSED/502; waitForFunction timeout) is a
  classic dev-server/proxy lifecycle race, not a defect in the ticket's code.
- The capture used the **fallback** plan (`capturePlanSource: "fallback"`,
  "sloped-dungeon fallback") and the server only ever loaded the default
  `training_caverns` quest (`profile=crowded`). **The spire-ascent stage was
  never exercised by this capture at all**, so it could not have caused the
  failure.

See `## Harness blockers` below.

## Code assessment (judged on merits)

The implementation is sound and the captured failure does not implicate it. All
relevant unit tests pass:

```
server/test/dungeon.test.js            125 passed
server/test/spire_ascent_spawn.test.js   5 passed
client/test/dungeon.test.js             28 passed
client/test/renderer-camera-orbit.test.js 3 passed
Test Files  4 passed (4)   Tests  161 passed (161)
```

Per-criterion findings (code-level — not runtime-confirmed because the capture
failed):

- **Selectable via `generateLayout({ stage: "spire-ascent" })`** — ✅ `generateLayout`
  branches to `generateSpireAscent(seed)` on `profile === 'spire-ascent'`
  (`game/server/dungeon.js`), and the `spire-ascent` profile is registered.
- **3–5 distinct tiers, each above the previous in Y** — ✅ `numTiers = 3 + floor(rng()*3)`
  (range 3–5). `tierYs` is strictly increasing (`tierYs[i] + risePerRamp`); each
  tier has flat `floorCorners`. Covered by `spireAscentTierRooms`/monotonic-Y
  tests in `server/test/dungeon.test.js`.
- **Ramps with slope ≥ 0.2** — ✅ `risePerRamp = 10/numRamps`, `rampDepth = 6`, so
  slope = `risePerRamp/6` ∈ [2.5/6≈0.42 (5 tiers) … 5/6≈0.83 (3 tiers)] — always
  ≥ 0.2. Ramps built via shared `buildDescentRampRoom`.
- **Total Y gain ≥ 10** — ✅ but **exactly at the boundary**: total rise =
  `numRamps × (10/numRamps) = 10` for every tier count. Meets `≥ 10`; see nit
  about leaving margin.
- **Outer walls on every tier and ramp (no fall-through)** — ✅ each tier emits
  left/right walls plus north/south walls, with ramp-width gaps only where a
  ramp connects (`buildHorizontalWallWithGaps`); the bottom and top get solid
  end walls.
- **Camera follow tracks ascent** — ✅ `client/test/renderer-camera-orbit.test.js`
  confirms `updateCameraOrbit` raises target/lookAt Y with elevated `playerY`
  and `initScene` uses `sampleFloorY` at spawn. Not runtime-confirmed (capture
  failed) but unit-verified.
- **Enemy spawns distributed across tiers** — ✅ `pickSpireAscentEnemySpawn`
  reserves one bottom slot, one top slot, then cycles remaining enemies across
  middle tiers; `spire_ascent_spawn.test.js` exercises distribution.
- **Objective/exit on final tier, reachable on foot** — ✅ `spawnCrystals` and
  `spawnLoot` place on the top tier (`tiers[tiers.length-1]`) for spire-ascent;
  reachability via the ramp graph is unit-tested. Foot-reachability is asserted
  by the layout-traversability tests.
- **Deterministic given a seed** — ✅ single `mulberry32(seed)` stream;
  `spire_ascent_spawn.test.js` asserts determinism for a fixed seed.
- **Unit tests (tier count, monotonic Y, reachability, no orphan tier)** — ✅
  present and passing.

### Debug scenarios — OK

This ticket adds `spire-ascent` and `spire-ascent-stage` to `DEBUG_SCENARIOS`
and `applyDebugScenario` (`game/server/index.js`). Verified against all three
debug-scenario rules:

- **Gated to a dev path** — both are only reachable through `applyDebugScenario`
  (the `?debugScenario=` entry), the same gate as the existing `sunken-canyon`
  scenarios. Normal gameplay does not touch them.
- **End-state reachable normally** — the `spire_ascent` quest is defined in
  `QUEST_DEFS` and returned by `listQuests()` (sent to clients), so a player can
  deploy into it normally; `spire-ascent` scenario uses the same
  `applyLayoutForQuest('spire_ascent')` + `spawnEnemies()` path.
- **No weakened invariants** — the scenario does not skip layout/collision
  rebuild (`rebuildWallColliders`, `computeWalkableAABBs`) and floors the player
  via `sampleFloorY`; it does not short-circuit server validation.

## Remaining gaps

1. **No runnable proof — capture failed (infra).** The verdict is FAIL solely
   because the capture never reached a playable state (server vacated `:3001`,
   client ECONNREFUSED/502, `waitForFunction` timeout). This is a dev-server/proxy
   lifecycle failure, **not** a defect in the spire-ascent code. The fix is to
   re-run the capture, not to edit `game/`. See `## Harness blockers`.

There are **no blocking code gaps**: the diff compiles, the server boots, 161
unit tests pass, and every acceptance criterion is satisfied at the code level.
Had the capture succeeded, this ticket would pass.

## Harness blockers

The capture failed before exercising the game. Detected signature: none
(`capture_diagnosis.detected: []`), but the evidence is an infrastructure
server/proxy race, not game code:

- `metrics.json` → `port_holders`: `"3001": []` (server process gone at
  diagnosis), `"5174"` held by vite.
- `client.log` tail:
  ```
  11:07:09 AM [vite] http proxy error: /api/login
  AggregateError [ECONNREFUSED]:
  11:07:10 AM [vite] http proxy error: /socket.io/?EIO=4&transport=polling…
  AggregateError [ECONNREFUSED]:
  ```
- `console.log`: repeated `Failed to load resource: … 502 (Bad Gateway)` then
  `page.waitForFunction: Timeout 12000ms exceeded.`
- `server.log` shows a clean boot (`Server listening on port 3001`,
  `Player connected`) with no error/stack trace — the server itself was healthy.

**Operator action:** re-run the capture for ticket 136 after ensuring the game
server stays up on `:3001` for the duration of the browser session (investigate
why the server process exited / why the proxy upstream was refused). Do **not**
modify `game/` — further code edits will not change the outcome until the
capture can connect.

VERDICT: FAIL
