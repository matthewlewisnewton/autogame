# Senior review — ticket 142: Cleanup sloped-floor layout and geometry

**Ticket:** [ticket.md](../ticket.md) (cleanup nits from 116)  
**Baseline:** `8a9aa16` (harness screenshot log fix); ticket commits `faf3b89`–`d371c44` (8 sub-tickets)  
**Capture:** round-2 (`metrics.json`, `console.log`, logs)

---

## Runtime health (blocking gate)

| Check | Result |
|-------|--------|
| `metrics.json` present | Yes |
| `metrics.json` `"ok": true` | **No** (`"ok": false`) |
| `harness_failure` block | No (dev servers started; see `server.log`) |
| `console.log` `pageerror` / `[fatal]` from game code | None |
| Benign noise only | Vite connect lines; no THREE/WebGL fatals |

**Conclusion:** The game client initializes (`[initScene] Initializing Three.js scene…`, socket reconnect) and the server listens on port 3000. There is no evidence of an uncaught game runtime crash in `console.log`. However, harness rules require `"ok": true` in `metrics.json`; round-2 capture failed before any screenshots or probes were recorded, so there is **no runnable proof** of the sloped-ramp acceptance path for this round.

**Capture failure chain (round-2):**

1. Gemini plan executed `emitScenario` → `[capture:error] Too many arguments` — Playwright `page.evaluate` was called with two serializable arguments (`scenarioName`, `timeoutMs`); Playwright allows only one (see `harness/screenshot.mjs` ~613–617).
2. Fallback recipe ran → `[createLobby] #lobby-browser not visible` → timeout filling `#create-lobby-name` (element exists but hidden).
3. `metrics.json`: empty `screenshots[]`, `scenarios[]`, `error` set to the `createLobby` fill timeout.

Round-1 had `"ok": true` and generic movement screenshots, but **no** ramp/sloped screenshot (fallback predated sub-ticket 08’s sloped-dungeon append).

---

## Per-criterion findings

### Document `floorCorners` schema in `design.md`

**Met.** `game/docs/design.md` § Floor Geometry names `floorCorners: { yNW, yNE, ySE, ySW }`, labels corners relative to room center, and points to `floorSampling.esm.js` (commit `faf3b89`).

### Wall meshes align with `sampleFloorY()` on sloped rooms

**Met in code and tests.** `buildDungeon()` sets room wall base Y from `sampleFloorY(layout, wallX, wallZ)`:

```250:252:game/client/dungeon.js
			const wallBaseY = sampleFloorY(layout, wallX, wallZ) ?? DEFAULT_FLOOR_Y;
			const wallMesh = new THREE.Mesh(wallGeo, wallMaterial);
			wallMesh.position.set(wallX, wallBaseY + WALL_HEIGHT / 2, wallZ);
```

`game/client/test/dungeon.test.js` asserts each wall mesh `position.y` matches `sampleFloorY + WALL_HEIGHT / 2` for a Z-slope room (commit `7aa010e`). Passage walls still use flat `FLOOR_Y` — out of this ticket’s AC (see nits).

### Harness ramp-focused capture

**Not met for round-2 (blocking).** Acceptance requires at least one screenshot whose description states a sloped room/ramp is in frame after deploy with `{ slopes: true }`. Round-2 produced zero screenshots. Sub-ticket work added `sloped-dungeon` to the capture-plan prompt, `emitScenario` harness action, and fallback steps `04-sloped-ramp`, but round-2 never reached them.

**Would pass if capture worked?** Partially — fallback recipe is structurally correct (auth → lobby → gameplay → `emitScenario` `sloped-dungeon` → screenshot), but `emitScenario` is currently broken for the Gemini path, and fallback flaked on lobby UI visibility in this run.

### Sloped floor mesh box approximation

**Met.** `buildSlopedFloor()` JSDoc documents the rotated `BoxGeometry` as an intentional visual approximation of bilinear `sampleFloorY()`, with four-corner `BufferGeometry` deferred (commit `af23765`).

---

## Design consistency and regressions

- **design.md:** Floor geometry section aligns with shared sampling and ticket 116 foundations.
- **Normal gameplay:** `applyLayoutForQuest()` already calls `generateLayout(seed, profile, { slopes: true })` at server startup and on quest layout — sloped floors are not debug-only for deploy.
- **requirements.md:** No regression to core 3D/socket/movement requirements; round-2 simply did not complete visual capture.
- **Unit tests:** Full `pnpm test:quick` run passed (1234 tests) during review; dungeon wall-Y and floorCorners tests are in the suite.

---

## Debug scenario: `sloped-dungeon` (added in this ticket)

| Rule | Assessment |
|------|------------|
| Gated to debug/dev | **OK** — client: `?debugScenario=` only on localhost; server: `isDebugScenarioAllowed(socket)` (local origin/address or `ALLOW_DEBUG_SCENARIOS=1`). Harness uses `window.__requestDebugScenarioForTest` (test hook), not normal UI. |
| Same state reachable in normal play | **OK** — deploy uses `{ slopes: true }` layout generation; players enter sloped rooms without the scenario. |
| Does not skip invariants | **OK** — scenario runs inside `applyDebugScenario` (deck validation, `enterPlayingPhase`, server layout regen, `questUpdate` + client `rebuildDungeonLayout`). It is a QA layout refresh, not a bypass of net sync or persistence for production paths. |

**Note:** `sloped-dungeon` regenerates layout with the same seed/profile as the active quest; it is redundant with normal slope-enabled generation but useful for forcing a client rebuild during capture.

---

## Code quality (holistic)

- Focused diffs across `game/client/dungeon.js`, `game/docs/design.md`, `game/client/main.js` (debug test hook timeout), and `harness/screenshot.mjs`.
- No dead game code observed in the sloped-floor path.
- **Harness defect:** `emitScenario` `page.evaluate` multi-arg bug introduced in sub-ticket 07 — blocks Gemini capture plans and any step using two evaluate args.
- **Harness flake:** `createLobby` does not handle “already in squad lobby” after a partial failed run; round-2 log shows `#lobby-browser` hidden while `#create-lobby-name` exists in DOM.

---

## Remaining gaps

1. **Round-2 capture failed (`metrics.json` `"ok": false`)** — no screenshots/probes; ticket cannot pass without a green capture run.
2. **Harness ramp screenshot AC unverified** — no screenshot describing a sloped room/ramp in frame in round-2 (round-1 also lacked ramp framing).
3. **`emitScenario` Playwright bug** — `page.evaluate(fn, arg1, arg2)` must pass a single object; causes `Too many arguments` on the primary capture plan.
4. **Fallback `createLobby` reliability** — lobby name input not visible when `#lobby-browser` is hidden (stale session / wrong panel after failed first pass).

---

## Nits (non-blocking)

See [nits.md](./nits.md) — passage wall Y still flat; optional harness “already in lobby” skip.

---

VERDICT: FAIL
