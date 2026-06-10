# Retire fixture-only `boss-level-dormant` debug scenario

Remove the `boss-level-dormant` URL debug shortcut that deploys `BOSS_LEVEL_FIXTURE_DEF` (a test-only quest not in the normal catalog). Dormant boss-level QA is already covered by the live-quest shortcuts `crucible-duel-boss` and `vault-onslaught-boss`; keep `BOSS_LEVEL_FIXTURE_DEF` confined to unit tests.

## Acceptance Criteria

- `boss-level-dormant` is removed from `debugScenarios.js` handler logic and from both `ALLOW_DEBUG_SCENARIOS` allowlists in `index.js`.
- No debug scenario deploys or temporarily registers `BOSS_LEVEL_FIXTURE_DEF` in `QUEST_DEFS` at runtime.
- `BOSS_LEVEL_FIXTURE_DEF` remains exported from `quests.js` and continues to be used only by server unit tests (`boss_level_schema.test.js`, `boss_level_spawn.test.js`).
- Live boss-level debug shortcuts `crucible-duel-boss` and `vault-onslaught-boss` are unchanged and still deploy registered quests via the normal run path.
- `pnpm test:quick` passes.

## Technical Specs

- **`game/server/debugScenarios.js`** — Delete the `boss-level-dormant` branch and any `setupBossLevelFixtureDeploy` usage that exists solely for this scenario (retain the helper only if other debug paths still need it; otherwise remove dead code).
- **`game/server/index.js`** — Remove `'boss-level-dormant'` from both debug-scenario name arrays.
- **`game/server/quests.js`** — No change to `BOSS_LEVEL_FIXTURE_DEF` export; it stays a test fixture, not a player-facing quest.
- **`game/server/test/debug-scenarios.test.js`** — If any assertion references `boss-level-dormant`, remove or replace it; add a negative check that the removed name is not in the allowlist if useful for regression.

## Verification: code
