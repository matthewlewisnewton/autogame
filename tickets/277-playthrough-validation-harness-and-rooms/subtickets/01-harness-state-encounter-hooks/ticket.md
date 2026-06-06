# Harness-state hooks for stage-boss playthrough assertions

Expose the minimum encounter and god-mode fields on `window.__AUTOGAME_HARNESS_STATE__()` so the headless playthrough driver can assert boss spawn type, dormant→active transition, and god-mode enablement without scraping DOM or guessing from enemy positions alone.

## Acceptance Criteria

- `window.__AUTOGAME_HARNESS_STATE__()` returns an `encounter` object when `gameState.run.encounter` exists, containing at least `{ phase, bossEnemyId, locked }` (or `null` when there is no active run encounter).
- The harness state exposes `player.debugGodmode` (boolean) on the existing `player` sub-object so the driver can confirm `CLIENT_TO_SERVER.TOGGLE_DEBUG_GODMODE` took effect after calling `window.__toggleDebugGodmodeForTest()`.
- `objective` for `stage_boss` runs includes `bossDefeated` when present on `gameState.run.objective`, so victory assertions can distinguish “adds cleared” from “boss defeated”.
- Existing client unit tests pass; no change to normal (non-debug) gameplay — additions are read-only mirrors inside the existing `// v8 ignore` harness block.
- A focused client test (extend `game/client/test/main.test.js` or add a small harness-state test) asserts the new fields are populated when `gameState.run.encounter` and `player.debugGodmode` are set in the test fixture.

## Technical Specs

- `game/client/main.js`: extend the object returned by `window.__AUTOGAME_HARNESS_STATE__()` (~line 4427) with:
  - `encounter`: map from `gameState.run.encounter` (`phase`, `bossEnemyId`, `locked`) or `null`.
  - `player.debugGodmode`: copy from `me.debugGodmode`.
  - `objective.bossDefeated`: include when `runObjective.bossDefeated` is defined.
- `game/client/test/main.test.js` (or adjacent harness-state test): add one case that stubs `gameState.run.encounter` and `player.debugGodmode` and verifies the getter shape.
- No server changes expected for this sub-ticket.

## Verification: code
