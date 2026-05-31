# Senior review — 142-cleanup-sloped-floor-layout-and-geometry

**Baseline:** `ce5aea4` (116 top-level complete) → **HEAD** `21eaa56` (ticket commits `faf3b89`–`6b4a473` plus later harness fixes on main).  
**Capture:** `round-1/` (`metrics.json`, `console.log`, `screenshot.log`, logs).

---

## Runtime health (blocking gate)

| Check | Result |
|-------|--------|
| `metrics.json` present | Yes |
| `metrics.json` `"ok": true` | Yes |
| `harness_failure` block | None |
| `console.log` `pageerror` / `[fatal]` from game code | None |

`console.log` shows Vite connect, benign 409 on register (duplicate test user), scene init, and `[debugScenario] applied sloped-dungeon`. No `pageerror`, `[fatal]`, or harness `capture:error` lines. Client log has only THREE.Clock deprecation and Vite `ws proxy` ECONNRESET (ignored per harness rules).

**Game starts and loads:** pass.

---

## Acceptance criteria (top-level `ticket.md`)

### Document `floorCorners` schema in `design.md`

**Met.** `game/docs/design.md` **Floor Geometry** documents `floorCorners: { yNW, yNE, ySE, ySW }` with NW/NE/SE/SW relative to room center and references `floorSampling.esm.js` (`faf3b89`).

### Wall meshes ignore sloped floor height

**Met (code + unit assertion).** Room walls use bilinear floor height at each segment center:

```250:252:game/client/dungeon.js
			const wallBaseY = sampleFloorY(layout, wallX, wallZ) ?? DEFAULT_FLOOR_Y;
			const wallMesh = new THREE.Mesh(wallGeo, wallMaterial);
			wallMesh.position.set(wallX, wallBaseY + WALL_HEIGHT / 2, wallZ);
```

`client/test/dungeon.test.js` — `positions wall Y on sloped rooms using sampleFloorY` asserts all four walls against `sampleFloorY` + `WALL_HEIGHT / 2` (`7aa010e`). Passage side walls still use flat `FLOOR_Y` (out of this ticket’s AC; see nits).

### Harness ramp-focused capture

**Met in round-1 artifacts.**

- `metrics.json`: `"capturePlanSource": "file"`, `"capturePlanValid": true`, `"scenarios": ["sloped-dungeon"]`.
- `screenshots[]` includes two entries whose descriptions explicitly call out a **sloped room** and **floor ramp** (`01-sloped-room-overview.png`, `02-ramp-geometry-detail.png`).
- `screenshot.log` shows `validateRecipe` auto-injected auth/lobby prefix before `emitScenario`, then successful probes with `debugScenarioResult.ok` and `phase: "playing"`.
- Capture plan (`capture-plan-gemini.txt`) runs `emitScenario` → `sloped-dungeon` after `waitForGame`, matching the documented dungeon-state flow.

Normal deploy already uses `applyLayoutForQuest()` → `generateLayout(..., { slopes: true })`; the debug scenario forces a mid-session layout rebuild for QA but is not the only slopes path.

### Sloped floor mesh is a rotated box approximation

**Met (documented approximation).** `buildSlopedFloor` JSDoc states the rotated `BoxGeometry` intentionally approximates bilinear `sampleFloorY()`, with four-corner `BufferGeometry` deferred (`af23765`).

---

## Design / requirements consistency

- Matches `design.md` floor geometry; no conflict with `requirements.md` (3D scene, websocket, multiplayer, movement all exercised in capture probes).
- `pnpm test:quick`: 1234 tests passed (48 files) during review.
- `round-1/coverage.log` reported 0% on changed files (vitest found no matching changed-file set for this baseline run) — informational only.

---

## Code quality

- Game diff is small and focused: design doc, wall Y, JSDoc, dungeon wall unit test.
- Harness diff (capture plan prompt, `emitScenario`, recipe validation, sloped fallback, Playwright fixes) supports the ramp AC without altering gameplay invariants.
- No dead code or obvious bugs in the sloped-floor path.

---

## Debug scenario: `sloped-dungeon` (ticket 116; harness wired in 142)

| Rule | Assessment |
|------|------------|
| Gated to dev | Yes — `?debugScenario=` on localhost only (`main.js`); server `isDebugScenarioAllowed()`; production blocked unless `ALLOW_DEBUG_SCENARIOS=1`. Harness uses `__requestDebugScenarioForTest` / `emitScenario`, not production UI. |
| Normal path reaches equivalent state | Yes — `applyLayoutForQuest` always passes `{ slopes: true }`; server tests confirm sloped rooms in normal layout generation. |
| Does not weaken invariants | Yes — scenario only calls `generateLayout(seed, profile, { slopes: true })`, updates bounds/colliders, and broadcasts `questUpdate` / `stateUpdate`; no skip of auth, persistence, or combat simulation. |

`emitScenario` awaits `__requestDebugScenarioForTest`’s promise (bounded timeout) before continuing (`41b31d9` / current `screenshot.mjs`).

No blocking debug-scenario gap.

---

## Sub-ticket integration

| Area | Status |
|------|--------|
| 01 `floorCorners` in design.md | Done |
| 02 wall Y on slopes + test | Done |
| 03–14 harness capture plumbing | Done; round-1 capture satisfies ramp screenshot AC |
| Game code on main at HEAD | Includes all four game sub-tickets |

---

## Remaining gaps

None blocking. All five top-level acceptance criteria are met in code, tests, and round-1 capture artifacts.

### Nits (non-blocking)

See `nits.md`: passage wall base height on corridors.

---

## Summary

Round-1 capture provides runnable proof (`ok: true`, sloped/ramp screenshot descriptions, `sloped-dungeon` scenario applied cleanly). Game changes document schema, align room walls to `sampleFloorY()`, and document the box mesh approximation. Verdict: pass.

VERDICT: PASS
