# Senior Review — Ticket 138: Fix floorSampling ESM/CJS export

**Baseline:** `df09eff4198aca6e9ed6a22e5ee387697de0a575`  
**Implementation commits (game):** `7daf20c` … `778ee6c` (ESM sibling + client import swap + vitest regression + stale `.mjs` removal)  
**Round-2 delta on baseline:** `40b1c7a` — harness capture recipe only (`harness/screenshot.mjs`); no further `game/` changes.

## Runtime health (blocking gate)

| Check | Result |
|-------|--------|
| `round-2/metrics.json` present | Yes |
| `metrics.ok` | `true` |
| `harness_failure` block | Absent |
| Servers started | Yes — `server.log` ends with `Server listening on port 3000` |
| `console.log` `pageerror` / `[fatal]` from game code | **None** |
| Module export `SyntaxError` | **None** |

**Capture notes (non-blocking):** `console.log` records a harness `[capture:error] page.waitForFunction: Timeout 12000ms exceeded` on the first capture attempt, then a successful retry. HTTP `409 (Conflict)` lines on register are benign duplicate-user noise, not uncaught page errors. Vite connect/debug lines only.

**Harness state proof:** Probes report `phase === 'playing'`, `sceneInitialized: true`, `hasCanvas: true`, movement between probes (`x/z` changed after W/D screenshots), enemies and hand populated — the client module graph loads, auth/lobby/ready/deploy all complete.

**Independent verification (reviewer):** `pnpm --filter client test` (421 passed), `pnpm --filter server test` (812 passed), `pnpm --filter client build` succeeds with no export-resolution errors.

---

## Acceptance criteria

### 1. Dual consumption (server CJS + client ESM)

**Met.**

- **Server:** `game/server/dungeon.js` still uses `require('../shared/floorSampling.js')`. `floorSampling.js` remains CJS (`module.exports = { sampleFloorY, DEFAULT_FLOOR_Y }`). Server boot confirmed in capture `server.log`.
- **Client:** `game/client/collision.js` imports named symbols from `../shared/floorSampling.esm.js`. `floorSampling.esm.js` uses native `export` syntax so Vite/esbuild can statically resolve named exports in dev and production builds.

This matches the ticket’s recommended approach (3): a small ESM sibling for the browser while Node keeps the unchanged CJS path. The ESM file duplicates the pure function body instead of re-exporting from CJS (Vite cannot extract named exports from `module.exports`); comments in both files document the sync requirement.

### 2. Browser boot — no export errors; auth; `phase === 'playing'`

**Met.**

- No `does not provide an export named` or other `Uncaught SyntaxError` in `console.log`.
- Probes show full multiplayer flow into gameplay without `debugScenario` (normal path).
- Screenshots `02-after-w.png` / `03-after-d.png` corroborate in-dungeon play (movement keys). Initial frame description is squad lobby (post-auth), consistent with a full-flow capture rather than a broken blank page.

### 3. Vitest suites still pass

**Met.** Client and server suites pass locally; `shared-floor-sampling.test.js` guards ESM named imports.

### 4. `sampleFloorY` behaviour unchanged

**Met.** Logic in `floorSampling.js` and `floorSampling.esm.js` is byte-for-byte equivalent for the sampling loop. Existing server coverage in `game/server/test/dungeon.test.js` (`describe('sampleFloorY(layout, x, z)')`, corners, bilinear centre, outside → `null`, missing `floorCorners` → `DEFAULT_FLOOR_Y`) still passes without modification. Client regression test covers empty layout, flat room, and sloped bilinear centre.

---

## Design & requirements consistency

- **`game/docs/design.md`:** Floor geometry section referencing `sampleFloorY()` remains accurate; no design regressions.
- **`game/docs/requirements.md`:** 3D render, WebSocket connect, multiplayer presence, and movement sync are all exercised in capture probes — no foundation regression introduced by this export fix.

---

## Code quality

- **No dead artifacts:** `floorSampling.mjs` removed (`778ee6c`); repo has only `floorSampling.js` + `floorSampling.esm.js`.
- **Import graph:** Only `collision.js` and the new client test touch the ESM path; server stays on CJS.
- **Obvious bugs:** None found in the sampling logic or wiring.
- **Maintenance trade-off:** Duplicated pure function in two files is the main long-term risk (drift if one file is edited alone). Mitigated today by identical bodies and dual test coverage; acceptable for this ticket’s scope.

---

## Debug scenarios

This ticket did not add or change `?debugScenario=` shortcuts. No debug-scenario review required.

---

## Round-2 capture quality (informational, non-blocking)

- `capturePlanSource: "fallback-after-error"` — first Gemini-guided step timed out; fallback full-flow recipe succeeded.
- `metrics.json` `screenshots[]` does not list `01-auth-overlay.png` even though that file exists on disk; auth visibility is inferred from successful lobby→playing progression, not a dedicated metrics entry.
- `coverage.log` reports 0% on changed files (harness runs vitest without matching changed-file filter in this round); not a functional gap.

---

## Remaining gaps

**None (blocking).** Runtime proof and all acceptance criteria are satisfied.

---

## Nits (non-blocking)

See `round-2/nits.md` for backlog items (CJS/ESM deduplication, flat-room test coordinates).

VERDICT: PASS
