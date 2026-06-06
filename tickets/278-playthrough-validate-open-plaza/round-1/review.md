# Senior review: 278-playthrough-validate-open-plaza

## Runtime health

The round-1 capture is runnable and clean. `metrics.json` has `ok: true`, no `harness_failure`, and an empty `pageerrors` array. `console.log` contains only Vite connection messages, scene initialization, and booth ready-up logs; there are no `[pageerror]` or `[fatal]` entries from game code.

The validation run artifacts under `validation/open-plaza/` also show a completed `open-plaza` full run. `run-summary.json` reports `ok: true`, `preset: "open-plaza"`, `steps: "full"`, and all four assertions true.

## Acceptance criteria findings

### Reuse the 277 playthrough driver for Open Plaza

PASS. `harness/validate/playthrough.mjs` registers the new `open-plaza` preset and keeps the existing `rooms` preset path intact. The near-adds and boss-approach scenario requests are now conditional, so the Arena Trials preset can rely on the deploy's live adds, normal add clearing, natural encounter activation, and full-HP boss defeat without inventing missing arena debug shortcuts.

### Correct Arena Trials stage-boss target

PASS. The live game definitions show `arena_trials` tier 2 is the stage-boss Open Plaza variant, with `bossType: "arena_champion"` and `landmark: "arena_dais"`. The preset uses `questId: "arena_trials"`, `questTier: 2`, `bossType: "arena_champion"`, and `deployScenario: "arena-trials-tier-2"`, matching `game/server/quests.js` and `game/server/debugScenarios.js`.

The top-level ticket says "level-1", but the codebase's stage-boss Arena Trials contract is tier 2 unlocked from tier 1; tier 1 is a normal defeat-enemies objective and does not have the `arena_champion` stage boss. The implementation therefore follows the only live code path that can satisfy the requested stage-boss validation.

### Screenshots and validation artifacts

PASS. The expected artifacts exist and are readable: lobby browser, hub, level entry, mid-combat, boss dormant, boss active, boss defeated, and victory screenshots. `probes.json` and `run-summary.json` capture the key states: dormant boss at 456 HP, active locked encounter at 456 HP, then `runStatus: "victory"`, `runObjectiveComplete: true`, `bossDefeated: true`, and `lastRunSummaryStatus: "victory"`.

`findings.md` honestly documents the green run plus the observed rough edges, including harness flakiness across repeated runs, the missing arena champion model fallback, transient proxy noise seen outside the committed green run, and the generic "Rooms" findings-template label.

### Boss assertions

PASS. The validation asserts and records:

- Boss spawns: `bossTypes` includes `arena_champion`.
- Encounter activates: `encounterPhase` becomes `active` and `encounterLocked` is true.
- Boss HP reaches defeated state: `bossDefeated` is true after the boss step.
- Victory fires: final probe has `runStatus: "victory"` and objective complete.

### Debug scenario safety

PASS. This ticket did not add a new game debug scenario. It reuses `arena-trials-tier-2`, which is gated behind the existing debug-scenario socket path and `ALLOW_DEBUG_SCENARIOS` server gate. Normal gameplay still reaches the same end state by clearing Arena Trials tier 1, unlocking tier 2, deploying, clearing adds, entering the trigger radius, and defeating the boss. The playthrough harness only uses the debug scenario as a QA entry shortcut; the boss activation and defeat path in this run proceeds through normal encounter/combat logic.

### Design and requirements consistency

PASS. The implementation does not change `game/**` gameplay code, so it does not regress the documented lobby-to-dungeon core loop or the foundation requirements for 3D rendering, client/server connectivity, player visualization, and movement synchronization. The round-1 smoke capture confirms the game loads, connects, renders, enters play, and responds to movement/key-item input.

### Code quality and verification

PASS with non-blocking nits. The harness changes are small and scoped to `harness/validate/**`. `node harness/validate/playthrough.mjs --help` runs successfully, and `git diff --check` reports no whitespace errors. The provided coverage log is informational only and found no changed-file test files to cover.

The remaining rough edges are backlog-worthy rather than blockers for this validation ticket: the findings renderer still has hard-coded Rooms/annex-overseer labels, the arena champion model asset is missing and falls back to a placeholder mesh, and the Open Plaza full-HP run is documented as flaky over repeated executions.

## Remaining gaps

None.

VERDICT: PASS
