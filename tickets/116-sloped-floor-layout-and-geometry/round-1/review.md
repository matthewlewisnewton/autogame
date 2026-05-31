# Senior Review — Ticket 116: Sloped Floor Layout and Geometry

**Baseline:** `80c814274b1443741aca5e94dd11bc87c7c37ead` (HEAD; ticket 116 commits `2453fab`–`6f0c78d` are ancestors).  
**Capture:** `round-1/metrics.json`, `console.log`, screenshots, probes (2026-05-31).

---

## Runtime health (blocking gate)

| Check | Result |
|-------|--------|
| `metrics.json` present | Yes |
| `metrics.json` `"ok": true` | Yes — servers started, gameplay reached `phase: "playing"` |
| `harness_failure` block | Absent |
| `console.log` `pageerror` / `[fatal]` | None |
| Benign noise only | `[capture:error]` Playwright timeout on first attempt (harness retried successfully); Vite `EPIPE` / THREE.Clock deprecation in `client.log` — ignored per harness rules |

The captured run proves the game loads, connects, enters a live dungeon, and accepts movement input. Probes show `sceneInitialized: true`, canvas present, HP/MS updating after movement.

**Note:** Capture used `capturePlanSource: "fallback-after-error"` (generic lobby→play smoke), not a ramp-focused scenario. Runtime health passes; visual proof of ramps relies on unit tests plus code paths that enable `{ slopes: true }` on every quest layout (see below).

---

## Per-criterion findings

### Layout schema documents sloped floor regions

**Met.** Rooms carry `floorCorners: { yNW, yNE, ySE, ySW }` (world Y at each corner). `generateLayout()` JSDoc documents `options.slopes`. Corner ordering and bilinear sampling are documented in `game/shared/floorSampling.esm.js`. `game/docs/design.md` adds a **Floor Geometry** section describing sloped floors, `sampleFloorY()`, and deferral of movement-on-slopes to ticket 117.

**Nit:** `design.md` does not spell out the `floorCorners` property name/shape inline (see `nits.md`).

### `generateLayout()` emits sloped rooms on a deterministic test seed

**Met.** `generateLayout(seed, profile, { slopes: true })` applies 1–2 southward ramps (north edge `0.5`, south edge `2.0`), skips index 0 (start room). Seed `42` with `{ slopes: true }` is covered extensively in `game/server/test/dungeon.test.js` and `game/server/test/server.test.js` (determinism, at least one non-uniform room, start room flat).

Normal gameplay also uses slopes: `applyLayoutForQuest()` in `game/server/index.js` calls `generateLayout(seed, profile, { slopes: true })` for all quests.

### Shared `sampleFloorY(layout, x, z)`

**Met.** Canonical implementation in `game/shared/floorSampling.esm.js`; server loads via `game/shared/floorSampling.js` (CJS eval-bridge); client re-exports from `game/client/collision.js`. Bilinear interpolation with legacy fallback when `floorCorners` is absent (`DEFAULT_FLOOR_Y = 0.5`). Returns `null` outside rooms.

### Client `buildDungeon()` renders sloped floors

**Met.** `isUniformFloor()` chooses flat `BoxGeometry` at visual `FLOOR_Y` vs `buildSlopedFloor()` (rotated box along dominant X or Z axis). Tests in `game/client/test/dungeon.test.js` assert non-zero rotation, mixed flat/sloped layouts, and server-generated sloped layouts. Passages remain flat at `FLOOR_Y` (room-local scope per ticket notes — acceptable).

### Flat legacy layouts unchanged

**Met.** Absent or uniform `floorCorners` → flat mesh at `FLOOR_Y`, no rotation. `generateLayout()` without `{ slopes: true }` matches pre-slope output (equality tests). Explicit uniform corners render identically to legacy rooms without the field.

### Unit tests for `sampleFloorY`

**Met.** Client: `collision-hand.test.js`, `shared-floor-sampling.test.js`. Server: `dungeon.test.js` `describe('sampleFloorY')`. Flat room, sloped corners, center interpolation, outside-room `null`, missing-field fallback.

### Documentation note (design.md or controls.md)

**Met.** `game/docs/design.md` **Floor Geometry** section (controls.md unchanged — ticket allows either).

### Out-of-scope constraints (ticket notes)

**Met.**

- **No `move` / authoritative `player.y` sync changes** — `simulation.js` untouched in ticket 116 range; `player.y` remains fixed at `0.5` (ticket 117).
- **Extend `layout.rooms` / `layout.passages`, not replace** — passages unchanged; rooms extended with `floorCorners`.
- **Room-local slopes, not heightmap** — bilinear corners + rotated box ramps only.

---

## Design alignment & regression

- **design.md:** Floor geometry section matches implementation and correctly scopes movement to ticket 117.
- **requirements.md:** No regression to core setup (3D render, socket connect, multiplayer viz, WASD sync). Capture confirms live play.
- **Integration:** Layout with slopes flows server → `questUpdate` / lobby deploy → client `buildDungeon()`. Shared sampler keeps client/server height math aligned for future movement work.

---

## Debug scenarios

`sloped-dungeon` was added in ticket 116’s server changes:

| Rule | Assessment |
|------|------------|
| Gated to debug/dev | Yes — `DEBUG_SCENARIOS` + `isDebugScenarioAllowed()` (localhost / `ALLOW_DEBUG_SCENARIOS=1`; blocked in production). Entry only via `debugScenario` socket event / URL param harness. |
| Same state reachable in normal play | Yes — `applyLayoutForQuest()` already passes `{ slopes: true }`; deploying a quest yields the same sloped layout generation path without the debug shortcut. |
| Does not weaken invariants | Yes — calls the same `generateLayout`, `computeDungeonBounds`, `rebuildWallColliders`, and `questUpdate` broadcast; no auth/persistence bypass. |

Capture did not exercise `?debugScenario=sloped-dungeon`; not required for this ticket’s acceptance criteria.

---

## Code quality

- Clear separation: generation (`dungeon.js`), sampling (`shared/floorSampling.esm.js`), rendering (`client/dungeon.js`).
- Deterministic RNG-driven ramp placement; start room protected.
- **Tests:** Full quick suite — 1233 passed. Targeted slope tests — 33 passed.
- **Coverage artifact:** `coverage.log` reports 0% (no changed files vs baseline because HEAD equals baseline hash); not indicative of missing tests.
- No dead code observed in the slope path. Post-ticket cleanups (138–141) consolidated floor sampling into a single ESM source without changing 116 behavior.

---

## Capture vs. manual verification

Harness screenshots (`01-initial.png`–`03-after-d.png`) document lobby and generic gameplay movement, not an explicit ramp close-up. Given:

1. Runtime health passes,
2. `{ slopes: true }` is on the live quest path,
3. Unit tests assert sloped mesh rotation from real `generateLayout(42, …, { slopes: true })`,

the implementation satisfies the ticket’s **Verification: code** bar and the spirit of manual ramp confirmation, though a dedicated ramp screenshot would strengthen future harness rounds (nit only).

---

## Remaining gaps

None blocking. All acceptance criteria are met in the working tree; the game starts and plays cleanly in capture.

---

## Nits (non-blocking)

See `round-1/nits.md` for backlog items: explicit `floorCorners` schema in docs, wall Y alignment on sloped rooms, harness ramp capture, rotated-box vs. bilinear mesh fidelity.

---

VERDICT: PASS
