# Fly machine identity and lobby routing helpers

Introduce a small server module that reads this instance's Fly machine id from `FLY_MACHINE_ID`, decides when Fly-Replay routing is active, and resolves which machine should own a lobby-scoped connection. When routing is disabled (no `REDIS_URL` or no `FLY_MACHINE_ID`), every lookup returns "handle locally" so dev/tests behave exactly as today.

## Acceptance Criteria

- `game/server/redis.js` `getInstanceId()` prefers `process.env.FLY_MACHINE_ID`, then `INSTANCE_ID`, then the existing random UUID fallback
- New `game/server/flyReplay.js` exports at least: `getFlyMachineId()`, `isFlyReplayEnabled()`, `resolveLobbyRouting(lobbyId)` (async)
- `isFlyReplayEnabled()` is `true` only when Redis is enabled **and** `FLY_MACHINE_ID` is set; otherwise `false`
- `resolveLobbyRouting(lobbyId)` uses `getLobbyOwner(lobbyId)` from `lobbyRegistry.js`:
  - owner matches local machine → `{ action: 'self' }`
  - owner is a different machine → `{ action: 'replay', machineId }`
  - owner unknown (`null`) → `{ action: 'self', claimOwner: true }` (caller may `registerLobby` to assign self)
- With Redis disabled or `FLY_MACHINE_ID` unset, `resolveLobbyRouting` always returns `{ action: 'self' }` without touching Redis
- `game/server/test/fly_replay.test.js` covers self, replay, unknown-owner, and disabled fallback paths with mocked registry + env
- Existing `lobby_registry.test.js` and full server vitest suite still pass with `REDIS_URL` unset

## Technical Specs

- **File:** `game/server/redis.js`
  - Extend `getInstanceId()` to check `FLY_MACHINE_ID` first (ticket canonical id on Fly)
- **New file:** `game/server/flyReplay.js`
  - `getFlyMachineId()` → trimmed `FLY_MACHINE_ID` or `null`
  - `isFlyReplayEnabled()` → `isRedisEnabled() && !!getFlyMachineId()`
  - `resolveLobbyRouting(lobbyId)` → async; normalize `lobbyId` to non-empty string or treat as no-lobby (self)
  - Do **not** emit HTTP headers here — pure decision logic only
- **New file:** `game/server/test/fly_replay.test.js`
  - Mock `lobbyRegistry.getLobbyOwner`; set/clear `FLY_MACHINE_ID`, `REDIS_URL`, `enableRedisForTests()`
- No changes to `index.js` or client in this sub-ticket

## Verification: code
