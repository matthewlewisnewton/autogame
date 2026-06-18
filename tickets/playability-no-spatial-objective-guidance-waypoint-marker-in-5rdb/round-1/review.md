# Senior Review — playability: spatial objective guidance for collect_items prisms

## Runtime health (gate)

- `metrics.json`: `ok: true`, `pageerrors: []`, no `harness_failure` block. Servers started; capture URL loaded.
- `console.log`: only benign noise — a transient `401` and a "WebSocket closed before connection established" during the auth/connect race, then `[initScene]` and `[launchBooth] ready-up via booth`. No `pageerror`/`[fatal]` lines from game code.
- Full client vitest suite passes (369 tests, 25 files); the two new test files pass (18 tests).

The game starts and loads cleanly. Gate passes.

Note on capture coverage: the fallback deterministic smoke ran a `defeat_enemies` run on the `crowded` layout, not a `collect_items`/`open` prism run, so no screenshot directly shows the compass. This is a capture-plan limitation, not a code defect — and it is actually a useful negative confirmation: for the captured `defeat_enemies` run the nav indicator correctly stayed hidden, which is exactly what `updateObjectiveNavIndicator()` does for non-`collect_items` objectives. The compass behavior itself is fully exercised by the unit tests and was visually QA'd in sub-ticket 02.

## Per-criterion findings

The ticket's EXPECTED bar: *"some directional/spatial guidance to objective items / next room (waypoint arrow, ping, or minimap) — at least for quest-critical loot like prisms."* It is explicitly filed as non-blocking UX/guidance.

### Directional guidance to quest-critical loot — MET
- `game/client/objectiveNav.js` adds pure helpers: `isQuestCriticalLoot` (gates on `kind === 'crystal' && questCritical === true`), `findNearestQuestCriticalLoot`, `computeWorldBearing` (`atan2(dz, dx)`, matching lock-on/movement convention), and `computeArrowRotation` (world bearing minus camera yaw via `shortestAngleDelta`, so the arrow takes the shortest arc and never flips at ±π).
- `updateObjectiveNavIndicator()` in `main.js:2351` renders a rotating arrow + distance readout (`#objective-nav-indicator`) pointing at the nearest uncollected quest-critical crystal. Distance shown in metres.

### Server data contract — MET (correct integration)
- The client reads `gameState.loot` for `kind:'crystal'` + `questCritical:true` items. These fields are produced server-side in `progression.js:2844-2852` (`spawnCrystals`) and the objective carries `type:'collect_items'` / `collectedItems` / `totalItems` (`objectives.js:131-149`). Loot is shipped to the client unstripped (`progression.js:3210,3714`).
- This ticket makes **zero server changes** (`git diff --name-only … game/server/` is empty) — it consumes the existing authoritative contract. No risk of bypassing validation/persistence/replication.

### Show/hide gating — MET (robust)
`updateObjectiveNavIndicator()` hides the indicator when: not in `playing` phase; no `run.objective`; objective type ≠ `collect_items`; all items collected (`collected >= total`); no local player; or no quest-critical crystal remains. Otherwise it shows (`display:flex`) and updates rotation + distance. Re-targets to next-nearest crystal automatically (covered by test).

### Wiring / lifecycle — MET
Updated on each `stateHandlers`/`runHandlers` event (1-line ctx additions) and additionally driven every frame via a `requestAnimationFrame` loop (`main.js:5362`), so the arrow tracks camera yaw smoothly even between server ticks. Hidden in lobby phase via CSS (`body[data-phase="lobby"] #objective-nav-indicator { display:none }`).

### Tests — MET
- `objectiveNav.test.js` (14 tests): nearest-selection, bearing math, rotation/shortest-arc.
- `objectiveNavIndicator.test.js` (4 tests): shows + rotates toward nearest crystal, hides on full collection, hides outside `playing` and for `stage_boss`, retargets after loot removal.

### Debug scenarios
No `?debugScenario` added or changed by this ticket — debug-scenario review section is N/A.

## Remaining gaps

None blocking. The minimum acceptance bar (directional guidance for quest-critical prisms in `collect_items` runs) is fully and robustly met, the game runs clean, and the feature is well-tested and correctly integrated with the existing server contract. Minor polish items are recorded in `nits.md` (none affect the verdict).

VERDICT: PASS
