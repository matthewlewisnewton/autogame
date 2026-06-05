# 05 — Fix arena-trials-tier-2 debug scenario run metadata

The `arena-trials-tier-2` debug shortcut must be invariant-equivalent to normal Arena Trials Tier 2 deployment. Today `applyDebugScenario()` calls `enterPlayingPhase()` (which runs `startDungeonRun()` / `spawnEnemies()`) **before** the scenario branch sets `selectedQuestId` / `selectedQuestTier` to `arena_trials` / `2`, so `spawnEnemy()` reads stale `run.questTier` for variant rolls and objective metadata.

## Acceptance Criteria

- Invoking `debugScenario` with `name: 'arena-trials-tier-2'` (with `ALLOW_DEBUG_SCENARIOS=1`) leaves lobby state equivalent to a normal Tier 2 deploy:
  - `state.selectedQuestId === 'arena_trials'` and `state.selectedQuestTier === 2`.
  - `state.run.questId === 'arena_trials'` and `state.run.questTier === 2` (not the pre-scenario default tier).
  - Layout is open-plaza with rigid mode (`getLayoutGenerationOptions('arena_trials', 2).layoutMode === 'rigid'` applied via `applyLayoutForQuest`).
- Enemies spawned by the scenario use Tier 2 variant rolls: under a fixed seed, at least one spawned enemy has a non-null `variant` (same expectation as `arena_trials_tier2.test.js` deploy path).
- `state.run.objective` matches the Tier 2 quest objective definition (enemy count / labels from `getQuest('arena_trials', 2)`), not a stale Tier 1 or default-quest objective.
- Tier 1 `arena_trials` deploy and other debug scenarios are unchanged.
- New regression test covers the debug shortcut end-to-end; `pnpm test:quick` passes.

## Technical Specs

- **`game/server/debugScenarios.js`**
  - Move `arena-trials-tier-2` handling **before** the shared `enterPlayingPhase(lobby)` call (follow the `quest-tier-2-unlocked` early-branch pattern): unlock Tier 2, set `selectedQuestId` / `selectedQuestTier`, call `applyLayoutForQuest(state, 'arena_trials', 2)`, position the player, **then** call `enterPlayingPhase(lobby)` so `createRunState()` snapshots the correct quest/tier.
  - After entering playing phase, clear and respawn arena enemies if needed (`state.enemies = []`, `spawnEnemies()`) so cover-aware placement matches the regenerated rigid layout; emit `questUpdate` / `lobbyUpdate` as today.
  - Remove the stale `else if (name === 'arena-trials-tier-2')` block below the generic `enterPlayingPhase` path to avoid double-handling.
- **`game/server/index.js`**
  - If `enterPlayingPhase` / `shouldSkipDefaultEnemySpawn` needs a small hook so the scenario does not spawn default grunts before the arena layout is applied, add `arena-trials-tier-2` to `DEBUG_SCENARIOS_WITHOUT_DEFAULT_SPAWN` (or equivalent) — only if the early-branch reorder alone cannot prevent incorrect first spawns.
- **`game/server/progression.js`**
  - No change expected if `run.questTier` is set correctly at `startDungeonRun()` time; only touch if a shared helper (e.g. `startDungeonRun` refresh after quest mutation) is the cleaner fix — document in code if used.
- **`game/server/test/debug-scenarios.test.js`** (or extend **`game/server/test/arena_trials_tier2.test.js`**) — Socket test: emit `debugScenario` `arena-trials-tier-2`, assert `testGameState().run.questTier === 2`, rigid layout options, and `enemies.some(e => e.variant)` under `ALLOW_DEBUG_SCENARIOS=1`.
- **Do NOT modify** passed sub-tickets 01–03 or review artifacts.

## Verification: code
