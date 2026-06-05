# Review: 260-miniboss-open-plaza

## Runtime health

PASS. The captured run loaded cleanly: `metrics.json` reports `"ok": true`, a started client URL, and an empty `pageerrors` array. `console.log` contains only Vite connection messages, scene initialization, and ready-up logs; there are no `pageerror` or `[fatal]` entries. `client.log` only shows the known THREE.Clock deprecation warning, and `server.log` shows normal startup/connect/disconnect output.

The capture used the fallback full-flow smoke plan rather than a boss-specific scenario. The screenshot filenames listed in `metrics.json` were not present as PNG files in the round folder, so visual confirmation comes from the existing sub-ticket QA plus code/tests rather than fresh image inspection in this round.

## Acceptance criteria

### A distinct plaza miniboss

PASS. `game/server/simulation.js` defines `arena_champion` as `Plaza Sovereign` with its own description and a meaningfully different profile from the generic `miniboss`: higher HP, higher damage, faster chase, wider cone, and longer range. `enemyDefFor('arena_champion')` resolves through the same registry path as the other enemy types.

PASS. `game/server/config.js` gives `arena_champion` its own card and magic-stone drop entries. Its magic-stone value is 70, strictly greater than the generic miniboss value of 50, and the normal enemy death path in `game/server/progression.js` uses those maps for loot/card rewards.

PASS. `game/server/quests.js` wires only `arena_trials` Tier 2 to `encounter.bossType: 'arena_champion'`; Tier 1 remains the existing `defeat_enemies` arena and other quest definitions are unchanged.

PASS. The existing stage-boss objective path in `game/server/objectives.js` spawns the configured boss type on the `arena_dais`, filters both `miniboss` and the configured boss type out of the add pool, and stores the boss ID for encounter wiring. `startDungeonRun()` carries the pending boss ID into `run.encounter.bossEnemyId`.

PASS. The defeat path is robust: `removeDeadEnemies()` records card/MS/currency drops, detects death of `run.encounter.bossEnemyId`, calls `onStageBossDefeated()`, marks `objective.bossDefeated`, and `checkRunTerminalState()` grants victory rewards through the shared run-completion flow. The focused tests cover add-only non-completion and active boss defeat completing the run with victory.

### Visual identity and telegraph

PASS. `game/client/renderer.js` adds a distinct `arena_champion` geometry with larger radius/height, a separate color/emissive palette, and its own cone telegraph. The telegraph mirrors the server-side cone angle and range.

PASS. `game/client/models.js` registers `arena_champion` in `MODEL_REGISTRY`. The `/models/arena-champion.glb` asset is not present, but the sub-ticket explicitly allowed a path with procedural fallback; the renderer keeps the distinct procedural mesh when model loading fails.

PASS. The renderer helper tests include `arena_champion` and assert that half-height/footprint lookup uses its own geometry instead of falling back to `grunt`.

### Debug scenarios

PASS. This ticket did not add a new URL debug scenario, but it changed the expected behavior of the existing `arena-trials-tier-2` and stage-boss debug paths by changing the underlying Tier-2 boss type. The scenarios remain debug-only via `?debugScenario`/localhost socket paths, and the server comments plus tests trace the normal path: clear Arena Trials Tier 1, unlock Tier 2, deploy, activate the encounter, and defeat the stage boss. They use the same quest, layout, spawn, encounter, and run-completion systems as normal gameplay.

### Design and requirements consistency

PASS. The change stays within the documented lobby-to-dungeon action-RPG loop and does not alter foundational rendering, WebSocket connection, multiplayer visualization, or movement synchronization requirements. It reuses the existing stage-boss and reward systems instead of creating a parallel completion path.

## Verification

- Captured run: `metrics.json` ok, no page errors; no fatal console output.
- Harness coverage log: 71 test files / 1434 tests passed with coverage visibility enabled.
- Additional focused check: `pnpm exec vitest run server/test/arena_trials_tier2.test.js client/test/renderer-registry-normalize.test.js client/test/models-registry.test.js --coverage.enabled=false` passed 3 files / 38 tests.
- An ad hoc `pnpm test -- --run ...` invocation also ran the full suite and all 2342 tests passed, but exited nonzero only because global coverage thresholds were active for that command.

## Remaining gaps

None.

VERDICT: PASS
