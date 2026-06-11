# Senior Review — Convert debugScenarios.js if-chain to a registry + move debug hooks out of hot paths

## Runtime health (gate)

The captured run is clean and is the proof this ticket runs:
- `metrics.json` → `"ok": true`, `"pageerrors": []`, no `harness_failure` block.
- `console.log` (7 lines) contains no `pageerror`/`[fatal]`/uncaught entries.
- The capture exercised a **registry-dispatched** scenario (`telepipe-ready`,
  `debugScenarioResult: { ok: true }`) end-to-end: in-dungeon → suspend →
  resume, and the preservation probe passed (`preservedIds: 2, missingIds: [],
  hpChangedIds: [], addedAllSpawnerAdds: true`). Scene initialized, canvas
  present. The refactored dispatch path is proven live, not just on paper.

## Acceptance Criterion

> applyDebugScenario dispatches via a registry map; shared setup extracted to
> helpers; hot-path debug checks reduced to one nullable field; existing
> debug-scenario tests pass

**Met, robustly.**

- **Registry dispatch** — `applyDebugScenario` (debugScenarios.js:5028) now
  looks up `DEBUG_SCENARIO_REGISTRY[name]` and invokes a single handler with a
  `{ lobby, state, player, socket, name, spawn }` ctx, falling back to
  `finishStandardPlayingDebugScenario`. The 113-branch (now 159-scenario)
  if-chain is gone — the only remaining `name ===` comparisons in the file are
  the 5 legitimate special-cases inside `syncDebugHooksForScenario` plus one
  unrelated rare-name check (Cinderghast). The registry has **159 keys**,
  exactly matching the **159 entries** in `DEBUG_SCENARIOS` (index.js), so every
  allowlisted scenario has a handler and there are no orphans.
- **Shared setup extracted** — copy-pasted layout/spawn/hand-sync setup is
  factored into named helpers (`prepareTelepipeReadyLobby`,
  `deployQuestTier1`, `setupQuestNearAdds`, `setupQuestBossApproach`,
  `finishQuestTier1DeployDebugScenario`, etc.), and registry entries are thin
  wrappers over them.
- **Hot-path checks reduced to one nullable field** — the production leaks
  called out in the ticket are gone:
  - `cardEffects.js` no longer holds `CARD_PROBE_DEBUG_SCENARIOS`; it reads
    `player.debugHooks?.cardProbe`, `?.pinMsOnTelepipePlace`,
    `?.extendedFreezeDurationMs`, `?.forceStatusRoll`.
  - `simulation.js:3833` `regenMagicStones` now checks
    `p.debugHooks?.pinMagicStonesZero` (was `debugScenario === 'summon-low-mana'`).
  - `progression.js` telepipe paths key off `debugHooks?.telepipeHand /
    telepipeDeploy / pinMsOnDeploy / spawnTelepipeDummy / suppressWavesAfterDeploy`.
  Each hot path now dereferences a single nullable object. `debugHooks` has one
  assignment site (`syncDebugHooksForScenario`, called from
  `resetPlayerForDebugScenario:687`), set in lockstep with `debugScenario`
  (line 686), and initialized to `null` in `buildPlayerRecord` (index.js:1084).
  The old per-scenario field `player.debugForceStatusRoll` is fully removed.
- **Tests pass** — full server vitest suite: **182 files, 2587 tests, all
  passing**. `server.test.js` was updated to import and call
  `syncDebugHooksForScenario` when constructing test players, keeping
  `debugScenario`/`debugHooks` consistent in unit fixtures.

## Debug-scenario rules check

This refactor adds one genuinely new scenario, `ember-descent-tier-1`
(index.js + registry). It is benign:
- **Gated** behind the same `DEBUG_SCENARIOS` allowlist (and
  `ALLOW_DEBUG_SCENARIOS` env) as every other scenario — URL param is the only
  entry point.
- **Reachable normally** — it calls the shared `deployQuestTier1(..,
  'ember_descent')` helper, deploying the real ember_descent Tier 1 quest run
  that a player reaches by playing that quest. It is a parallel of the existing
  `frost-crossing-tier-1` / `training-caverns-tier-1` deploy scenarios.
- **No invariant bypass** — it deploys an actual quest run through the same
  helpers; it does not skip validation, persistence, or replication.

Consistent with `game/docs/design.md` and does not regress the foundation:
this is a server-internal refactor of debug tooling with no gameplay-facing
behavior change, confirmed by the unchanged preservation/suspend-resume probe.

## Remaining gaps

None. The acceptance criterion is fully and robustly met, the game runs
cleanly in the captured registry-dispatched scenario, and the full server test
suite is green.

VERDICT: PASS
