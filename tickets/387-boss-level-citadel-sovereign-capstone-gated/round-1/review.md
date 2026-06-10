# Senior Review: 387-boss-level-citadel-sovereign-capstone-gated

## Runtime health

PASS. The captured run is usable proof that the game still starts and loads cleanly. `metrics.json` reports `"ok": true`, the server/client reached gameplay, `pageerrors` is empty, and `pageerrors.json` is `[]`. `console.log` contains only resource 409 lines plus normal startup logs; it has no `pageerror` or `[fatal]` entries from game code. The Vite `ECONNRESET` socket-close noise in `client.log` is benign per the review rules.

The capture plan was fallback smoke coverage rather than a Citadel-specific scenario, so the capstone itself is judged from the live code, tests, and coverage log rather than from a ticket-targeted browser capture.

## Acceptance criteria

### Add a capstone boss level using the boss-level framework

PASS. `game/server/quests.js` registers `citadel_siege` as a `stage_boss` quest with `levelKind: 'boss_level'`, `layoutProfile: 'boss-arena'`, and an `arena_dais` encounter. The shared boss-level framework then routes it through `stage_boss` spawning, dormant encounter setup, trigger activation, and victory completion. The boss-level reuse and Citadel-specific tests cover spawn count, dormant activation, boss defeat, and victory.

### Capstone boss: Citadel Sovereign

PARTIAL. `game/server/simulation.js` registers `citadel_sovereign` with display metadata, combat stats, loot drops, and client-side geometry/telegraph rendering in `game/client/renderer.js`. The boss appears in the enemy display catalog and resolves through `enemyDefFor`.

BLOCKING GAP: the encounter is not robustly the hardest level overall. `citadel_siege` spawns only one enemy (`addCount: 0`), and `citadel_sovereign` has 420 HP. Existing high-tier stage-boss levels have comparable or greater boss durability plus supports, for example `spire_ascent` tier 2 has a 420 HP boss with 5 supports, `arena_trials` tier 2 has a 420 HP boss with 4 supports, and `frost_crossing` tier 2 has a 440 HP boss with 4 supports. The Citadel Sovereign hits harder per strike, but total encounter pressure and total HP budget are lower than several existing Tier-II levels, so the "HARDEST level overall" criterion is not met.

### Gated behind multiple harder stage Tier-II clears

PASS. The quest uses an `unlockRequires` array requiring `canyon_descent` tier 2, `spire_ascent` tier 2, and `arena_trials` tier 2. `normalizeUnlockRequires`, `buildLevelUnlockGraph`, and the socket `selectQuest` handler preserve AND semantics: a partially completed account receives `tier_locked`, and a fully completed account can select the capstone.

### Shows on the level map and quest UI

PASS. `listQuestVariants()` includes the capstone variant, `buildLevelUnlockGraph()` emits the locked `citadel_siege:1` boss node with all three prerequisite edges, and the quest-board objective summary resolves to "Defeat Citadel Sovereign". The integration tests cover level-map graph data and client objective formatting.

### Debug scenario behavior

PASS with a non-blocking nit. The added `citadel-siege-boss` debug scenario is gated through the debug-scenario pathway, the same end state is reachable through normal play after the three Tier-II clears, and normal `selectQuest` gating remains tested separately. The scenario does persist prerequisite completions on the debug account as setup; this does not affect normal gameplay, but it is worth cleaning up later so QA shortcuts do not permanently mutate account progress.

### Consistency with design and foundation requirements

PASS except for the hardest-level tuning gap. The implementation remains consistent with the server/client architecture, lobby-to-dungeon flow, WebSocket movement, Three.js rendering, and the boss-level design direction in `game/docs/design.md`. The foundation requirements are not regressed: the captured run connects, renders, enters gameplay, and synchronizes movement.

### Code quality and tests

PASS for the implemented surfaces, aside from the blocking tuning issue. The new code is narrowly scoped and uses existing quest, objective, encounter, unlock, and rendering tables. Relevant tests in the coverage log passed, including `server/test/citadel_siege.test.js`, `server/test/citadel_sovereign_enemy.test.js`, `server/test/debug-scenarios.test.js`, `server/test/boss_level_reuse.test.js`, `server/test/level_unlock_graph.test.js`, and `client/test/questBoard.test.js`. Coverage output contains unrelated historical stderr noise from model URL loading in jsdom and socket disconnect cleanup, but no relevant failing tests were reported.

## Remaining gaps

1. `citadel_siege` is not the hardest overall level. It is a lone 420 HP boss, while existing Tier-II boss levels combine comparable or higher boss durability with 4-5 supports. Tune the Citadel encounter so its total challenge clearly exceeds `arena_trials`, `spire_ascent`, and `frost_crossing` Tier-II levels, and add a regression test that compares total encounter difficulty rather than only attack damage.

VERDICT: FAIL
