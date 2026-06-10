# Senior Review: Server memoize movement contexts

**Ticket:** Memoize `buildMovementContext` / `buildHubMovementContext` so wall colliders and walkable AABBs are not rebuilt every tick.

**Baseline:** `4b605e8552d6667e815a07d0020caab17390b0dd`  
**Commits:** `ec22ec1e` (playing-phase cache), `ff8e1c22` (hub-phase cache)

---

## Runtime health

| Check | Result |
|-------|--------|
| `metrics.json` present | Yes |
| `metrics.json` `"ok"` | `true` |
| `pageerrors` | `[]` (empty) |
| `failure_kind` | absent |
| `console.log` pageerror / `[fatal]` | None (only Vite connect, benign 409 on auth race, scene init) |

Captured run completed the full smoke flow: lobby ready-up → gameplay → WASD movement → dodge roll with cooldown HUD. Screenshots and probes show `phase: "playing"`, player position changes after W/D/dodge, and dodge cooldown UI toggles correctly — collision/movement paths exercised end-to-end.

---

## Acceptance criteria

### Movement contexts cached by layout reference and reused across ticks

**Met.** `game/server/simulation.js` adds module-level caches:

- **Playing:** `_movementContext`, `_movementContextLayout`, `_movementContextPassageLocksKey`
- **Hub:** `_hubMovementContext`, `_hubMovementContextLayout`

`buildMovementContext(state)` returns the cached object when `state.layout` reference and `passageLocksCacheKey(state.run?.passageLocks)` are unchanged. `buildHubMovementContext(hubLayout)` returns the cached object when `hubLayout === _hubMovementContextLayout`.

`runGameLoopTick` (`game/server/index.js:1495–1500`) still calls these builders every tick; on cache hits they no longer allocate fresh context objects or recompute colliders/walkable AABBs.

### Cache invalidates when `state.layout` changes

**Met.** Layout identity uses reference equality (`===`), matching the existing `_wallCollidersLayout` pattern. Any path that assigns a new layout object — `applyLayoutForQuest`, deploy, checkpoint restore (`deepCloneJson`), debug scenarios — produces a new reference and forces a cache miss on the next `buildMovementContext` call.

Passage-lock changes are also handled: when locks unlock/lock without a layout swap, `passageLocksCacheKey` changes and the playing-phase cache rebuilds (verified by existing `passage_locks.test.js`, which rebuilds context after wave clear).

`rebuildMovementContext(state)` is exported and called from `resetGameState()` for explicit test isolation.

### Collision behavior unchanged (existing tests pass)

**Met.** Harness vitest run: **1935 / 1935 tests passed** (`coverage.log`). Movement-heavy suites (`applyPlayerMovement.test.js`, `passage_locks.test.js`, `slippery_floor.test.js`, `lobby_hub_movement.test.js`, `integration.test.js` dodge probe) all pass. Browser capture shows movement and dodge without wall clipping or stuck players.

---

## Design & requirements consistency

- **design.md:** No movement/collision design rules violated. Optimization is internal to server simulation; floor sampling, passage barriers, and hub layout behavior unchanged.
- **requirements.md:** Server-client connectivity, multiplayer visualization, and WASD movement sync all demonstrated in capture. No foundation regression observed.

---

## Code quality

**Strengths**

- Mirrors the established `getWallColliders` / `_wallCollidersLayout` caching pattern — consistent with surrounding code.
- Playing-phase cache keys on both layout reference and passage locks, which is necessary for correct barrier colliders when locks toggle.
- Hub cache is appropriate: `HUB_LAYOUT` is a static constant shared by all lobbies.
- Minimal diff scope (two production files); no dead code introduced.

**Correctness notes (non-blocking)**

- Caches are module-global, not per-lobby. With multiple concurrent playing lobbies that have different layouts, the singleton cache alternates and may rebuild more often than a per-lobby cache would — but reference/key checks preserve correctness; hub cache still hits on every lobby tick.
- Cached `walkableAABBs` / `dungeonBounds` are references captured at build time. In practice these are always reassigned together with `state.layout` in `applyLayoutForQuest` and equivalent paths, so stale-reference risk matches pre-ticket behavior.

---

## Debug scenarios

This ticket did not add or modify any `?debugScenario=` shortcuts. No review required.

---

## Remaining gaps

None. Runtime proof is clean, acceptance criteria are fully met, and the test suite passes.

VERDICT: PASS
