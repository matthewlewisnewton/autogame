# Ember burn godmode sync and tick damage

Fix the godmode client/server desync that blocks burn DoT after combat godmode: the `ember-descent-ember-wraith-burn` scenario clears server `debugGodmode`, but the client mirror re-pins `debugGodmode: true` from stale `debugGodmodeResult` on every `stateUpdate`, so `damagePlayer` skips burn ticks. Prove with tests that burn ticks reduce HP when godmode is off.

## Acceptance Criteria

- `ember-descent-ember-wraith-burn` in `game/server/debugScenarios.js` emits `DEBUG_GODMODE_RESULT` with `{ ok: true, enabled: false }` to the requesting socket whenever it sets `player.debugGodmode = false`.
- After combat godmode is enabled, requesting `ember-descent-ember-wraith-burn` leaves **server** `player.debugGodmode === false` and the **client harness mirror** (`__AUTOGAME_HARNESS_STATE__().player.debugGodmode`) reads `false` after the next `stateUpdate`.
- A server integration test (extend `game/server/test/debug-scenarios.test.js` or `burning_tick_damage.test.js`) deploys `fire-cavern`, enables godmode, runs `ember-descent-ember-wraith-burn`, applies burning to the player with godmode off, advances simulated time past `BURN_TICK_INTERVAL_MS`, and asserts `player.hp` decreased.
- A client test in `game/client/test/debug-godmode.test.js` confirms `debugGodmodeResult.enabled: false` from the scenario keeps `harness.player.debugGodmode === false` across a subsequent `stateUpdate` (no stale re-enable).
- `cd game && pnpm test:quick` passes.
- **Out of scope:** regenerating `game/validation/fire/` artifacts (sub-ticket 13); harness probe edits unless a minimal unblock is required (document in handoff).

## Technical Specs

- **Edit:** `game/server/debugScenarios.js` — in the `ember-descent-ember-wraith-burn` branch, after `player.debugGodmode = false`, emit `SERVER_TO_CLIENT.DEBUG_GODMODE_RESULT` to the requesting socket with `{ ok: true, enabled: false }` (mirror `toggleDebugGodmode` handler in `game/server/socketHandlers/lobbyHandlers.js`).
- **Edit (only if emit alone is insufficient):** `game/client/main.js` — in the `stateUpdate` handler, do not re-apply `debugGodmodeResult.enabled: true` when the server scenario has explicitly cleared godmode (e.g. honor a fresh `debugGodmodeResult` with `enabled: false`, or skip mirror when `debugGodmodeResult.enabled === false`).
- **Edit:** `game/server/test/debug-scenarios.test.js` — add/adjust test: godmode on → ember-burn scenario → server godmode false → burn tick reduces HP (use `vi.setSystemTime` + `updateBurning` or simulation tick helper).
- **Edit:** `game/client/test/debug-godmode.test.js` — add test for godmode-off `debugGodmodeResult` surviving `stateUpdate`.
- **Read-only context:** `game/server/simulation.js` (`damagePlayer` godmode guard, `updateBurning`, `BURN_TICK_INTERVAL_MS`); `harness/validate/lib/cardMechanics.mjs` (`ensureDebugGodmodeOff`, `runEmberBurnStep`) for expected harness behavior.

## Verification: code
