# Senior Review: hud-objective-line-shows-only-quest-title-for-stage-boss-and-iykh

**Baseline:** `ac9280536aeb40729d7310ef87a2e032b2dded5e`  
**Commits:** 3 (`01-stage-boss-objective-hud`, `02-escort-objective-hud`, `03-survive-objective-hud`)  
**Changed game files:** `game/client/objectiveHud.js` (new), `game/client/main.js`, `game/client/test/objectiveHud.test.js` (new), `game/client/test/main.test.js`, `game/shared/theme.json`

## Runtime health

| Check | Result |
|-------|--------|
| `metrics.json` present | Yes |
| `metrics.json` `"ok"` | `true` |
| `pageerrors` | `[]` |
| `harness_failure` | absent |
| `console.log` pageerror / `[fatal]` | none (only Vite connect, benign 409 auth conflicts, `[initScene]` logs) |

The captured run started Vite on `:5177` and the game server on `:3004`, connected two players, entered gameplay on Initiate Vault (`defeat_enemies`), and probed a live HUD showing `Initiate Vault` + `Purged 0 / 6 hostiles`. No browser page errors.

## Acceptance criteria

### `stage_boss` — goal and live progress during a run

**Met.** New module `game/client/objectiveHud.js` formats boss goals via `formatObjectiveSummary` (e.g. Frost Crossing → "Defeat the Permafrost Warden") and appends live suffixes for scripted wave clearance (`Waves cleared X / Y`), support kills (`Supports cleared X / Y`), and completion (`Warden defeated`). `updateObjectiveHud()` in `main.js` routes `stage_boss` through `formatRunObjectiveHudLines({ run, questMeta })` using `findQuestBoardEntry`.

Evidence: 5 pure unit cases in `objectiveHud.test.js` plus integration test `shows stage_boss goal and progress for frost_crossing tier 1` in `main.test.js`.

### `escort` — goal and live ambush / destination progress

**Met.** Escort branch builds goal from quest metadata ("Escort Archivist Vale to treasure") or `run.escort.npcName` fallback; progress shows `ambush X / Y cleared`, destination reached, en-route-to-extract, or failure label. Wired in the same `updateObjectiveHud()` branch as `stage_boss`.

Evidence: 5 escort unit tests + `shows escort goal and ambush progress for annex_escort tier 1` integration test.

### `collect` — non-empty goal/progress line

**Met (pre-existing, preserved).** `collect_items` still renders `{collected}/{total} prisms` on the second HUD line (`THEME.objectives.collectPrismsProgress`). Unchanged from baseline; integration test `shows prism progress for collect_items` still passes.

### `survive` — goal and live wave / purge progress

**Met.** Survive branch shows goal via `formatObjectiveSummary` / `THEME.objectives.surviveHostiles`, prefixes spawn progress while `spawnedEnemies < totalSpawns` (`Wave X / Y spawned`), and always includes `Purged X / Y hostiles`. Wired in `updateObjectiveHud()`.

Evidence: 3 survive unit tests + `shows survive goal and wave progress for endless_siege tier 1` integration test.

### Text updates as sub-progress changes

**Met.** All new formatters read live `run.objective`, `run.scriptedEncounter`, `run.escort`, and `run.encounter` fields. `updateObjectiveHud()` is invoked from `stateHandlers.js` and `runHandlers.js` on state updates, so HUD text refreshes with server replication.

## Design & requirements consistency

- Aligns with `game/docs/design.md` quest-identity section: Frost Crossing, Annex Evacuation, and survive contracts now surface mid-run objective context in the HUD instead of relying on transient comms toasts.
- Client-only presentation change; no server simulation, persistence, or net-replication paths altered. Meets `game/docs/requirements.md` foundation (3D render, socket connect, movement) — capture confirms connected gameplay.

## Code quality

- Clean separation: pure formatting in `objectiveHud.js`, DOM wiring stays in `main.js`.
- Reuses existing `formatObjectiveSummary` and `THEME.objectives` keys; minimal new theme strings.
- No dead code or new debug scenarios introduced.
- **Tests:** `coverage.log` reports 369 client tests passed (20 files), including all 13 new `objectiveHud` cases and 3 new `updateObjectiveHud` integration cases. No regressions observed.

## Debug scenarios

No new `?debugScenario=` shortcuts were added. N/A.

## Capture vs. ticket scope

The round-1 harness used the **fallback** smoke plan on default Initiate Vault (`defeat_enemies`), not Frost Crossing / Annex Evacuation / Endless Siege. Browser capture therefore does not visually prove the three newly wired objective types, but:

1. Runtime health is clean.
2. Capture probe `bodyText` confirms the objective HUD renders correctly for the default quest.
3. Per-type behavior is covered by integration tests that exercise the real `updateObjectiveHud()` path with quest-board metadata.

This is a harness-coverage gap (nit), not a code defect.

## Remaining gaps

None blocking. All acceptance criteria are satisfied in code and tests; the game loads and runs cleanly in capture.

VERDICT: PASS
