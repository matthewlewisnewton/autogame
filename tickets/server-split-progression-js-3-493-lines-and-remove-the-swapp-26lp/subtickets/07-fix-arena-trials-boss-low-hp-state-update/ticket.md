# Fix arena-trials-boss-low-hp stateUpdate race

The `arena-trials-boss-low-hp` debug scenario correctly mutates server state (boss at 1 HP), but the Vitest suite observes a stale `stateUpdate` from the prior `arena-trials-tier-2` deploy (boss still at 420 HP). Fix event ordering or test synchronization so the emitted snapshot reflects the post-mutation boss HP.

## Acceptance Criteria

- `pnpm test` passes with zero failures (specifically `server/test/debug-scenarios.test.js` tests named `positions arena_champion at 1 HP beside the player in playing phase` and `positions arena champion at 1 HP beside the player in playing phase`).
- After `arena-trials-tier-2` then `arena-trials-boss-low-hp`, the `stateUpdate` payload observed by the test reports the arena champion at `hp === 1` (not `420`).
- In-memory server state after `arena-trials-boss-low-hp` still has the boss at 1 HP, beside the player, with encounter active and locked.
- No regressions to other `arena-trials-*` debug scenarios or their tests.

## Technical Specs

**Files to change:**

- `game/server/debugScenarios.js` — in the `arena-trials-boss-low-hp` branch (~line 749), ensure the `stateUpdate` emitted after pinning `boss.hp = 1` is the snapshot clients/tests observe. If a deferred tier-2 `stateUpdate` can still fire, either route this scenario through the same `finishStageBossDebugScenario` emit path used by `arena-trials-tier-2` or guarantee the low-HP emit happens after any tier-2 follow-up broadcasts.
- `game/server/test/debug-scenarios.test.js` — in both failing tests (~lines 401 and 1174), fix the `stateUpdate` wait so it does not capture a stale deploy snapshot. After awaiting `arena-trials-tier-2` `debugScenarioResult`, drain any pending `stateUpdate` events from tier-2 (e.g. loop/`socket.off` drain, or a predicate helper that resolves only when the boss enemy in the payload has `hp === 1`) before asserting on the low-HP snapshot.

**Implementation notes:**

- Root cause: `waitForEvent(socket, 'stateUpdate')` registered after tier-2 completes can resolve on a leftover tier-2 deploy update (boss at full HP) instead of the `arena-trials-boss-low-hp` mutation update.
- Prefer a small predicate-based `waitForStateUpdate` helper (boss `hp === 1`) shared by both duplicate tests over brittle fixed delays.
- Do not change boss base HP in `ENEMY_DEFS` or encounter logic — this is a debug-scenario emit/sync bug only.

## Verification: code
