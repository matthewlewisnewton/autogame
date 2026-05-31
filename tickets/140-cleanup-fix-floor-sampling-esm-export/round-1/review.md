# Senior review — ticket 140: Cleanup nits from 138-fix-floor-sampling-esm-export

**Baseline:** `b36a846786e1acdb205fa0f30aa978226344f9fc`  
**Commits:** `dd29958` (deduplicate floorSampling sources), `e612f4b` (align flat-room test coordinates)  
**Capture:** `round-1/metrics.json`, `console.log`, screenshots `01-initial.png`–`03-after-d.png`

---

## Runtime health (blocking gate)

| Check | Result |
|-------|--------|
| `metrics.json` present | Yes |
| `metrics.json` `"ok": true` | Yes — Vite on `:5173`, gameplay capture completed |
| `harness_failure` block | Absent |
| `pageerror` / `[fatal]` in `console.log` | None |

**Notes (non-blocking noise):** First capture attempt logged `[capture:error] page.waitForFunction: Timeout` then retried successfully. HTTP 409 on an early resource load (likely harness auth/session collision) did not prevent scene init (`[initScene] Initializing Three.js scene...`). `client.log` has benign THREE.Clock deprecation and Vite `ws proxy` / `EPIPE` on disconnect.

**Gameplay proof:** Probes show `phase: "playing"`, `sceneInitialized: true`, canvas and card hand visible, player moved (position changed between probes after W/D input). Screenshots document lobby → gameplay flow.

The captured run demonstrates a clean load and playable session. **Runtime gate: PASS.**

---

## Acceptance criteria

### 1. Deduplicate floorSampling CJS/ESM sources

**Criterion:** Server CJS and client ESM read from one source of truth with no duplicated `sampleFloorY` / `DEFAULT_FLOOR_Y` function bodies.

**Findings:**

- `game/shared/floorSampling.esm.js` is the sole location of the algorithm (exports `DEFAULT_FLOOR_Y` and `sampleFloorY`).
- `game/shared/floorSampling.js` is a thin CJS wrapper: reads `floorSampling.esm.js` at `require` time, strips `export` keywords, evaluates via `new Function`, and re-exports `{ sampleFloorY, DEFAULT_FLOOR_Y }`. No duplicated implementation body.
- `game/server/dungeon.js` still uses synchronous `require('../shared/floorSampling.js')` unchanged.
- `game/client/collision.js` still imports from `floorSampling.esm.js` unchanged.
- Manual check: `node -e "require('./shared/floorSampling.js')"` returns `DEFAULT_FLOOR_Y === 0.5` and correct flat-room center sample; function body is compiled from the ESM file text.
- Server integration: `game/server/test/dungeon.test.js` `sampleFloorY` suite (153-test integration run included) exercises the CJS path; all **1233** tests pass under `pnpm test:quick`.

**Verdict:** Fully met. The eval-at-load bridge satisfies “shared ESM” as canonical source; a separate parity test is optional per ticket wording (“…async import, codegen, **or** a test that asserts…”) and is not required when the server literally executes the ESM file contents.

### 2. Align flat-room regression test with ticket spec coordinates

**Criterion:** Flat-room case uses `(0, 0)` at room center and still expects `DEFAULT_FLOOR_Y`.

**Findings:**

- `game/client/test/shared-floor-sampling.test.js` calls `sampleFloorY(layout, 0, 0)` with comment “(0, 0) is the room center”.
- Expectation remains `0.5` (`DEFAULT_FLOOR_Y`). Covered in round-1 `coverage.log` (4/4 tests in that file pass).

**Verdict:** Fully met.

---

## Design & requirements consistency

- `game/docs/design.md` § Floor Geometry references `sampleFloorY()` for sloped walkable height; behavior unchanged, still shared between client prediction and server authority.
- No references in `game/docs/requirements.md`; no foundation regression observed.
- No new or modified `?debugScenario=` shortcuts (`metrics.json` probes: `debugScenario: null` throughout). **Debug-scenario checklist: N/A.**

---

## Code quality

**Strengths**

- Clear wrapper comments in `floorSampling.js` stating ESM is canonical and bodies must not be duplicated again.
- Minimal diff scope (two game files + ticket metadata); sub-ticket intent preserved.

**Non-blocking observations (see `nits.md`)**

- `floorSampling.esm.js` header still says “Mirrors the logic in floorSampling.js” / “Keep in sync” — outdated after deduplication.
- CJS bridge uses string rewrite + `new Function`; fragile if the ESM file later adds top-level `import`/`export` beyond the two regex patterns (acceptable for current pure-function module, worth documenting).

---

## Tests & coverage

- Round-1 `coverage.log`: vitest ran changed-path coverage; `shared-floor-sampling.test.js` 4/4 pass. Wrapper `floorSampling.js` not directly unit-tested (executed indirectly via server `dungeon.test.js`).
- Independent `pnpm test:quick`: 48 files, 1233 tests, all pass.

---

## Remaining gaps

None. Both acceptance criteria are satisfied; runtime capture confirms the game runs.

---

VERDICT: PASS
