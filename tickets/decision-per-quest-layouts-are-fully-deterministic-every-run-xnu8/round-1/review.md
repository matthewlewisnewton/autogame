# Senior review — per-quest layout determinism decision + implementation

**Ticket:** `decision-per-quest-layouts-are-fully-deterministic-every-run-xnu8`  
**Baseline:** `654ad2bf`  
**Commits reviewed:** `f2fb288c` (docs), `3f4008a9` (per-run spawn seed), `9a9ab826` (checkpoint lifecycle)  
**Capture:** `round-1/metrics.json`, `round-1/console.log`

---

## Runtime health

| Check | Result |
| --- | --- |
| `metrics.json` present | Yes |
| `ok` | `true` |
| `pageerrors` | `[]` (empty) |
| `failure_kind` | absent |
| `console.log` fatal/pageerror | None — only Vite connect, scene init, and a benign HTTP 409 during auth |

The captured run reached squad lobby, deployed into **Initiate Vault** (`training_caverns`), moved, and exercised dodge-roll HUD. Scene initialized, socket connected, gameplay phase active. **Game starts and loads cleanly.**

---

## Parent decision (option b)

The parent ticket asked whether per-quest layouts should stay fully deterministic or split geometry from objective placement. The decomposed plan chose **option (b)** and implemented it across three sub-tickets.

**Finding:** Option (b) is recorded in `game/docs/design.md` under **Layout & spawn determinism** and fully implemented in server code. The motivating `crystal_rescue` / Prism Salvage example, PRO/CON tradeoffs, and seed split are all documented. No regressions against `game/docs/requirements.md` (foundation still holds; this change is server-side spawn policy only).

---

## Sub-ticket 01 — Record layout determinism decision (docs)

| Criterion | Status |
| --- | --- |
| `design.md` section chooses option (b) | Met — explicit decision line and prose |
| `questLayoutSeed` sole layout seed, stable per quest+tier | Met — documented in seed split bullets |
| Scripted waves room-anchored, not memorizable coords | Met — dedicated paragraph |
| `crystal_rescue` / Prism Salvage named as motivator | Met |
| No game logic changes in 01 alone | Met — only `design.md` in commit `f2fb288c` |

---

## Sub-ticket 02 — Per-run objective spawn seed

| Criterion | Status |
| --- | --- |
| Fresh deploy assigns new `runSpawnSeed` before `spawnEnemies()` | Met — `checkAllReadyInner` sets `_gameState.runSpawnSeed = generateRunSpawnSeed()` at layout apply, then `spawnEnemies()` runs |
| Same quest+tier → identical layout, different crystal `(x,z)` | Met — `quest_per_run_spawn.test.js` asserts room signatures match and crystal tuples differ for seeds `111_111` vs `222_222` |
| Same `runSpawnSeed` → reproducible crystal positions | Met — direct `spawnCrystals` test and deploy replay test |
| Combat/loot/scripted waves stay on layout RNG | Met — `spawnEnemies` uses `layoutRng = mulberry32(layoutSeed + 1000)` for combat and loot; `buildQuestScriptSpawnCtx` exposes `rng` from layout seed; `collect_items.spawnQuestEntities` is the only consumer of `ctx.objectiveRng` |
| `stateSnapshot` exposes `runSpawnSeed` | Met — `buildWorldSnapshot` includes it; test asserts value |
| `quest_per_run_spawn.test.js` + `pnpm test:quick` | Met — 4 new tests; full suite 3896/3896 pass (re-run during review) |
| `questLayoutSeed` / layout apply unchanged | Met — no edits to `dungeon.js` or layout preview paths |

**Implementation notes (verified in live code):**

- `generateRunSpawnSeed()` uses `crypto.randomInt(1, 0x7fffffff)` — not derived from `questLayoutSeed`.
- `objectives.js` `collect_items.spawnQuestEntities` calls `ctx.spawnCrystals(layout, ctx.objectiveRng, crystalCount)`.
- `captureWorldState()` persists `runSpawnSeed` for checkpoint flows (wired in sub-ticket 03).

---

## Sub-ticket 03 — Checkpoint spawn-seed lifecycle

| Criterion | Status |
| --- | --- |
| Telepipe suspend → resume keeps crystal positions + `runSpawnSeed` | Met — `server.test.js` asserts checkpoint capture and resume restore identical `(x,z)` tuples and seed |
| Resume does not re-call `spawnEnemies()` | Met — explicit spy test |
| Abort sortie → fresh deploy mints new seed + crystals, same `layoutSeed` | Met — `server.test.js` and `integration.test.js` socket-level abandon + redeploy |
| Normal waiting-lobby redeploy gets new `runSpawnSeed` | Met — `giveUpRun` then re-ready test |
| Tests pass | Met |

`restoreCardCheckpoint` restores `world.runSpawnSeed` and `world.loot` from checkpoint before re-entering play; the suspended-checkpoint branch in `checkAllReadyInner` returns before the fresh-deploy `generateRunSpawnSeed()` path.

---

## Debug scenario — `crystal-rescue-suspended-hub`

Added in sub-ticket 03 for QA of suspend/resume checkpoint state.

| Requirement | Status |
| --- | --- |
| Gated behind debug path only | Met — registered in `DEBUG_SCENARIOS` / `DEBUG_SCENARIOS_WITHOUT_DEFAULT_SPAWN`; invoked only via `debugScenario` socket when `ALLOW_DEBUG_SCENARIOS=1` |
| Equivalent state reachable through normal play | Met — scenario runs `setupCrystalRescueTier1Deploy` then `suspendRunToLobby()`, same as deploy → telepipe → extract all squadmates; comment documents this |
| Does not weaken invariants | Met — uses production `suspendRunToLobby()` checkpoint capture; no bypass of server validation or persistence |

`debug-scenarios.test.js` confirms suspended checkpoint retains integer `runSpawnSeed` and three crystal positions in `worldState.loot`.

---

## Code quality

- **Seed separation is clean:** layout stream and objective stream are explicitly split; only `collect_items` crystal placement consumes `objectiveRng`.
- **Checkpoint symmetry:** `runSpawnSeed` is captured and restored alongside `layoutSeed` and loot — consistent with telepipe durability rules in `design.md`.
- **No dead code:** new exports (`generateRunSpawnSeed`, `ensureRunSpawnSeed`) are used by tests and the deploy path.
- **Test depth:** unit (`quest_per_run_spawn.test.js`), server lifecycle (`server.test.js`), integration socket abandon (`integration.test.js`), and debug-scenario smoke cover the full matrix.
- **Coverage artifact:** `round-1/coverage.log` reports 1969/1969 tests passed; scoped file report only surfaces `index.js`/`cards.js` (harness diff filter), but changed `progression.js` / `objectives.js` paths are exercised by the new and extended tests above.

---

## Remaining gaps

None. All acceptance criteria from the three sub-tickets are met; runtime capture is clean; tests pass.

---

## Nits (non-blocking)

See `nits.md` — stale doc tense in `design.md` only.

VERDICT: PASS
