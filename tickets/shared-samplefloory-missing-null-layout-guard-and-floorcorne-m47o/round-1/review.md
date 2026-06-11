# Senior Review — sampleFloorY null-layout guard and floorCorners fallback

**Ticket:** `shared-samplefloory-missing-null-layout-guard-and-floorcorne-m47o`  
**Baseline:** `4974010ad526acbf5a28795f183c75d7dcfd21b6`  
**Implementation commit:** `b9c499dc` (sub-ticket `01-null-layout-and-platform-fallback`)

## Runtime health

| Check | Result |
|-------|--------|
| `metrics.json` present | Yes |
| `metrics.json` `"ok"` | `true` |
| `pageerrors` | `[]` (empty) |
| `failure_kind` | absent |
| `harness_failure` | absent |
| `console.log` `pageerror` / `[fatal]` | none |

The harness capture completed a full deterministic smoke flow (auth → lobby → ready → gameplay with WASD movement and dodge roll). Probes show `phase: "playing"`, `sceneInitialized: true`, `connectionState: "connected"`, and normal player Y (`0.5`) on a flat start room. The lone `[A:error] Failed to load resource: 409 (Conflict)` lines are HTTP registration conflicts during harness account setup — not uncaught page errors and not game-breaking.

**Verdict on runnable proof:** Game starts and loads cleanly.

## Per-criterion findings

### 1. `sampleFloorY` returns `DEFAULT_FLOOR_Y` for null layout

**Met.** `game/shared/floorSampling.esm.js` now opens with:

```31:32:game/shared/floorSampling.esm.js
export function sampleFloorY(layout, x, z) {
	if (!layout) return DEFAULT_FLOOR_Y;
```

This mirrors the existing `sampleFloorSurface` guard and protects callers that pass `layout` through without a prior null check — notably server `resolveEntityY(player, ctx.layout)` during the simulation tick (`simulation.js:733,760,789`) and client `resolveEntityY` in `entityWorldY.js:15`, which previously would throw `TypeError: Cannot read properties of null`.

Returning `DEFAULT_FLOOR_Y` (not `null`) is correct: callers that skip `resolveFloorY` still get a finite height.

### 2. `sampleFloorY` returns `DEFAULT_FLOOR_Y` for platforms missing `floorCorners`

**Met.** The platform containment branch now uses the same per-corner fallback pattern as the room branch:

```49:58:game/shared/floorSampling.esm.js
				const fc = platform.floorCorners;
				const yNW = fc ? fc.yNW : DEFAULT_FLOOR_Y;
				const yNE = fc ? fc.yNE : DEFAULT_FLOOR_Y;
				const ySE = fc ? fc.ySE : DEFAULT_FLOOR_Y;
				const ySW = fc ? fc.ySW : DEFAULT_FLOOR_Y;
				return (
					(1 - u) * (1 - v) * yNW +
					u * (1 - v) * yNE +
					u * v * ySE +
					(1 - u) * v * ySW
```

At platform center `(0,0)` on a platform with no `floorCorners`, bilinear interpolation of four `DEFAULT_FLOOR_Y` corners yields `DEFAULT_FLOOR_Y` (0.5).

### 3. Unit tests cover both edge cases (server + client)

**Met.** Matching tests added in:

- `game/server/test/dungeon.test.js` — `describe('sampleFloorY(layout, x, z)')` block
- `game/client/test/shared-floor-sampling.test.js` — `describe('ESM floorSampling re-export')` block

Both test null layout (two coordinates) and platform-without-`floorCorners` at center. Harness `coverage.log` reports these suites passing (14 client tests, 229 server dungeon tests). Independent re-run of the full vitest suite: **3972 tests passed**.

### 4. Existing sloped-room / open-plaza behavior unchanged when `floorCorners` present

**Met.** The diff only adds the early return and replaces direct `fc.yNW`…`fc.ySW` reads with local variables that equal the old values when `floorCorners` is fully populated. Existing platform interpolation tests (`sampleFloorY platform sampling (open-plaza)`) and extensive sloped-room coverage in `dungeon.test.js` continue to pass.

### 5. CJS bridge untouched (`.esm.js` is sole logic source)

**Met.** `game/shared/floorSampling.js` is unchanged; it eval-loads `floorSampling.esm.js` at require time, so server `require('./dungeon')` paths pick up the fix automatically.

## Design & regression check

- **design.md:** Floor geometry section documents `sampleFloorY()` as the canonical walkable-surface height function in `shared/floorSampling.esm.js`. The fix hardens that function without changing its contract for valid layouts.
- **requirements.md / foundation:** No regressions observed. Change is defensive only; no gameplay, networking, or persistence behavior altered for normal runs.
- **Integration:** Open-plaza platform precedence, room bilinear interpolation, and `resolveFloorY` null-coalescing remain consistent. Server tick and client prediction paths that call `sampleFloorY(layout, …)` with a possibly-null `layout` are now safe.

## Debug scenarios

Not applicable — this ticket did not add or modify any `?debugScenario=` shortcuts.

## Code quality

- Minimal, focused diff (one production file + mirrored tests).
- No dead code, no console errors in capture, no page errors.
- Naming and fallback style match the existing room-branch pattern.

## Remaining gaps

None. All acceptance criteria are fully and robustly satisfied; the captured run proves the game is healthy.

VERDICT: PASS
