# Senior Review: escort harness `runObjectiveComplete` fix

**Ticket:** escort: harness `runObjectiveComplete` flips true on enemy-clear before escort reaches destination  
**Baseline:** `e89fd90718eabe166cad4d3e09b16ebf823b23d0`  
**Commits reviewed:** `d24422c4` (client logic), `ec618fab` (regression tests)

## Runtime health

| Check | Result |
|-------|--------|
| `metrics.json` present | Yes |
| `metrics.json` `"ok"` | `true` |
| `pageerrors` | `[]` (empty) |
| `failure_kind` | absent |
| `console.log` fatal/pageerror from game code | None |

The captured run started cleanly on port 5176. Console shows only Vite connect, scene init, and a benign `409 (Conflict)` on resource load (duplicate auth/register during two-player setup). No uncaught exceptions or `[fatal]` lines from game code.

**Note:** Round-1 capture used the fallback Initiate Vault (`defeat_enemies`) smoke plan, not the `escort-near-destination` debug scenario described in the ticket repro. Runtime health is confirmed; escort-specific browser proof comes from vitest (see below).

## Per-criterion findings

### 1. `runObjectiveComplete` is false when escort enemies are cleared but destination not reached

**Met.** `game/client/main.js` now branches on `objective.type === 'escort'` before the generic `defeatedEnemies >= totalEnemies` fallback:

```4900:4909:game/client/main.js
	const runEscort = gameState?.run?.escort;
	const runObjectiveComplete = !!objective && (
		objective.type === 'collect_items'
			? (objective.collectedItems ?? 0) >= (objective.totalItems ?? 0)
			: objective.type === 'stage_boss'
				? objective.bossDefeated === true
				: objective.type === 'escort'
					? (runObjective?.reachedDestination === true || runEscort?.atDestination === true)
						&& runEscort?.failed !== true
					: (objective.defeatedEnemies ?? 0) >= (objective.totalEnemies ?? 0)
	);
```

With `defeatedEnemies === totalEnemies`, `reachedDestination: false`, and `escort.atDestination: false`, the escort branch evaluates to `false` — matching the ticket repro (enemies 0, run still `playing`, instrumentation must not report complete).

Vitest: `runObjectiveComplete is false for escort when all enemies cleared but not at destination`.

### 2. `runObjectiveComplete` is true only when escort reaches destination and has not failed

**Met.** Logic mirrors server `OBJECTIVE_DEFS.escort.isComplete` in `game/server/objectives.js` (L364–367): requires `objective.reachedDestination` **or** `run.escort.atDestination`, and rejects when `run.escort.failed`.

Server reference:

```364:367:game/server/objectives.js
    isComplete(objective, run) {
      if (!objective.reachedDestination && !run?.escort?.atDestination) return false;
      if (run?.escort?.failed) return false;
      return true;
    },
```

Vitest covers both destination flags (`reachedDestination: true` and `escort.atDestination: true`) and the failure guard (`escort.failed: true` → false even at destination).

### 3. Player-facing HUD unaffected

**Met.** No changes to `game/client/objectiveHud.js`. Escort HUD already gates destination messaging on `run.escort.atDestination` / `objective.reachedDestination` separately from ambush kill counts (L138–157). The bug was isolated to harness instrumentation (`__AUTOGAME_HARNESS_STATE__`), consistent with the ticket's stated impact.

### 4. Non-escort objective types unchanged

**Met.** `collect_items`, `stage_boss`, and default `defeat_enemies` branches are untouched. Existing `runObjectiveComplete` tests for `stage_boss` still pass. Round-1 capture probes show `defeat_enemies` run with `runObjectiveComplete: false` while enemies remain — no regression signal.

### 5. Harness checks pass

**Met.**

- Round-1 `coverage.log`: 336 client tests passed (21 files); full suite in this review: **4110 tests passed** (`pnpm test:quick`).
- New escort regression tests live adjacent to existing `stage_boss` harness-state tests in `game/client/test/main.test.js` (L5204–5285).

### 6. Consistency with design docs and no foundation regression

**Met.** `game/docs/design.md` describes Annex Evacuation escort gameplay; this change aligns harness telemetry with server completion semantics without altering gameplay. `game/docs/requirements.md` has no conflicting harness or escort instrumentation requirements.

### 7. Debug scenarios

**N/A — no debug scenarios added or modified in this ticket.** The pre-existing `escort-near-destination` scenario (`game/server/debugScenarios.js`) was the repro vehicle; it was not touched by either commit. No new `?debugScenario=` entry points were introduced.

## Code quality

- **Focused diff:** Two game files changed (`main.js` +4 lines logic, `main.test.js` +84 lines tests). No dead code, no unrelated refactors.
- **Correct data sources:** Reads `runObjective.reachedDestination` from full run state (not the trimmed harness `objective` snapshot, which omits that field) and `gameState.run.escort` for `atDestination` / `failed`.
- **Pattern consistency:** Follows the existing per-type ternary chain used for `collect_items` and `stage_boss`.

## Integration assessment

Sub-tickets 01 (client logic) and 02 (regression tests) integrate cleanly. The client harness field now matches server `isComplete` for escort runs, closing the false-pass gap that caused automated escort validators to conclude success at ambush clear. Unit tests lock the three critical states (cleared-not-arrived, arrived-not-failed, failed-at-destination). Browser capture confirms general game health but does not re-run the escort repro in Playwright — acceptable given targeted vitest coverage of the exact bug.

## Remaining gaps

None. All acceptance criteria are satisfied; runtime capture is healthy; tests pass.

VERDICT: PASS
