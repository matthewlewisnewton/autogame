# Fix canyon-descent-boss-low-hp stateUpdate snapshot reporting full miniboss HP

The vitest coverage gate fails on `server/test/debug-scenarios.test.js > debugScenario — canyon-descent-tier-2 > positions miniboss at 1 HP beside the player in playing phase`: the captured `stateUpdate` reports the canyon miniboss at 300 HP (`expected 300 to be 1`) even though the scenario sets `boss.hp = 1`. This blocks the whole 365 ticket's quality gate. Make the canyon low-HP scenario/test deterministically deliver the post-mutation (1 HP) snapshot so the suite is green.

## Acceptance Criteria

- `cd game && pnpm test` (full vitest suite with coverage) passes with zero failing tests; specifically the canyon-descent low-HP test no longer fails with `expected 300 to be 1`.
- The `canyon-descent-boss-low-hp` debug scenario emits a `stateUpdate` whose boss enemy entry reports `hp === 1` AFTER all encounter mutations (including any `activateEncounter`/`lockEncounter` calls) have run — i.e. the broadcast snapshot reflects the 1-HP boss, not the full-HP boss.
- The live-state assertions in the test (`boss.hp === 1`, `phase === ACTIVE`, `locked === true`, distance bounds) continue to hold.
- No production game behavior outside the debug-scenario path changes; the fix is confined to the canyon low-HP scenario flow and/or its test's snapshot-capture ordering.
- The other low-HP debug-scenario tests (training-caverns, arena-trials, spire-ascent) remain passing and untouched in behavior.

## Technical Specs

- `game/server/debugScenarios.js` — the `canyon-descent-boss-low-hp` branch (around lines 1004–1042). Unlike the passing `training-caverns-boss-low-hp` / `spire-ascent-boss-low-hp` branches, this one calls `activateEncounter(state.run)` and `lockEncounter(state.run)` AFTER `boss.hp = 1` and before emitting the snapshot, and its tier-2 setup leaves the encounter active so the game loop emits periodic `stateUpdate`s. Investigate two likely causes: (a) `activateEncounter`/`lockEncounter` (or game-loop ticks they enable) re-deriving/healing the boss HP back toward `maxHp`/300, and (b) a race where a periodic game-loop `stateUpdate` is captured instead of the scenario's final `stateSnapshot()`. Fix so the final emitted `stateSnapshot()` is built strictly after the boss is pinned to 1 HP — e.g. re-assert `boss.hp = 1` (and `boss.maxHp`) immediately before the `io.to(lobby.id).emit(SERVER_TO_CLIENT.STATE_UPDATE, stateSnapshot())` call, ensuring activation/lock cannot restore HP.
- `game/server/test/debug-scenarios.test.js` — the canyon test (around lines 990–1025). If the root cause is a race with periodic `stateUpdate`s rather than the scenario itself, make the capture deterministic: wait for the `debugScenarioResult` first, then read the boss HP from the latest/post-result `stateUpdate` (e.g. capture the stateUpdate emitted at-or-after the scenario result, mirroring how the passing low-HP tests reliably observe 1 HP), rather than whichever `stateUpdate` arrives first after emit.
- Keep the change minimal and scoped to the canyon low-HP scenario and its test. Do not alter `cardRenderers.js`, VFX, or other scenarios.

## Verification: code
