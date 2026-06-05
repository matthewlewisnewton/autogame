## Per-Criterion Findings

### Runtime health

PASS. The captured run starts and loads cleanly. `metrics.json` reports `"ok": true`, `pageerrors` is empty, and `console.log` contains only normal Vite connection and Three.js scene initialization output. The screenshots and probes show a two-player lobby, deployment into the dungeon, movement, and dodge/key-item cooldown HUD with no debug scenario active.

### Migrate meaningful progression/handler call sites to explicit lobby/state args

PASS. The implementation migrated a coherent set of progression flows:

- Shop/medic helpers now accept optional explicit state parameters: `refreshShopOffer(state = _gameState)`, `ensureShopOffer(state = _gameState)`, and `healAtMedic(playerId, state = _gameState)`.
- Card reward helpers now accept explicit state: `buildCardChoices(playerId, state = _gameState)` and `claimCardReward(playerId, cardId, state = _gameState)`.
- Run teardown helpers now accept explicit state: `returnPlayersToLobby(state = _gameState)`, `giveUpRun(state = _gameState)`, and `abandonSuspendedRun(state = _gameState)`.
- Socket handlers that already have lobby state in scope pass it through for medic heal, card reward claim, return-to-lobby, give-up, and abandon-suspended-run paths.

This is an incremental but meaningful reduction in direct reliance on the context-swapped progression global, and the unchanged default parameters preserve direct test/helper callers.

### Tests green / behaviour unchanged

FAIL. The provided `coverage.log` shows the suite is not green:

```text
FAIL  |server| server/test/account.test.js > GET /api/me > returns profile and default settings
AssertionError: expected 500 to be 201
...
Test Files  1 failed | 42 passed (43)
Tests  1 failed | 946 passed (947)
```

This blocks the top-level acceptance criterion even though the failure is outside the files changed by this ticket. The next round needs to make the current `pnpm test:quick` / coverage run pass or provide a clean rerun if the failure was caused by test isolation state.

### Design and foundation consistency

PASS. The changes are server-side state-threading refactors and do not alter the documented lobby -> dungeon -> reward loop, multiplayer visualization, movement synchronization, card combat, or run suspend/resume design. The captured run confirms the foundation still renders, connects via WebSockets, shows player state, and moves in gameplay.

### Debug scenarios

PASS. This ticket did not add or change a `?debugScenario=NAME` shortcut. The capture ran normal gameplay with `debugScenario: null`, so there is no new debug-scenario invariant to validate.

## Remaining gaps

1. `coverage.log` shows `pnpm test:quick`/coverage is not green: `server/test/account.test.js > GET /api/me > returns profile and default settings` received HTTP 500 from `/api/register` where the test expected 201. This violates the ticket acceptance criterion that tests are green.

VERDICT: FAIL
