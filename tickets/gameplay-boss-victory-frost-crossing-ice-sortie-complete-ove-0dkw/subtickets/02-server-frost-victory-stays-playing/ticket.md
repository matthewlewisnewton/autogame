# Server: frost_crossing Tier-1 victory must not emit lobby-phase snapshots before hub return

Investigate and fix the server-side source of the lobby-phase `stateUpdate` that races `runComplete` on frost_crossing ice playthroughs. After boss defeat, `gamePhase` must remain `playing` with `run.status === 'victory'` until the player explicitly emits `returnToLobby`; per-tick `hotStateSnapshot()` emissions must reflect that.

## Acceptance Criteria

- Integration test: deploy `frost_crossing` Tier 1 (stage_boss), defeat the Permafrost Warden / clear the objective, await `runComplete`, then collect the next several `stateUpdate` payloads — **none** have `gamePhase === 'lobby'` while waiting for an explicit `returnToLobby`.
- The same test asserts `run.status === 'victory'` and `run` is still present on those snapshots (run is not deleted by suspend/return helpers).
- `testGameState().gamePhase` remains `'playing'` after `checkRunTerminalState()` resolves victory for frost_crossing Tier 1.
- Spire-ascent / other stage_boss presets that already pass are not regressed (existing tier-2 / stage_boss victory tests still green).
- If the erroneous lobby transition comes from a specific helper (`suspendRunToLobby`, `broadcastLobbyUpdate` after tier unlock, debug-scenario redeploy, etc.), that path is guarded so terminal victory runs cannot trigger it.

## Technical Specs

- **Add/extend:** `game/server/test/frost_crossing_victory_phase.test.js` (or extend `frost_crossing_stage_boss.test.js` / `frost_crossing_tier2.test.js`) — socket-level capture of `stateUpdate` + `runComplete` ordering for Tier-1 real deploy (use `frost-crossing-boss-low-hp` or direct simulation mirroring playthrough boss defeat).
- **Likely edit (root-cause dependent):** `game/server/progression.js` (`checkRunTerminalState`, `maybeSuspendRun`, `suspendRunToLobby`) — ensure victory terminal state never calls lobby transition helpers.
- **Possible edit:** `game/server/index.js` game loop — confirm per-tick `hotStateSnapshot()` after victory does not reflect a spurious `setGamePhase(..., LOBBY)`; fix any frost_crossing-specific tick hook if identified.
- **Possible edit:** `game/server/debugScenarios.js` — if a frost_crossing harness scenario leaves a deferred lobby transition (e.g. redeploy / `setPhase` side effect), neutralize it before victory.

## Verification: code
