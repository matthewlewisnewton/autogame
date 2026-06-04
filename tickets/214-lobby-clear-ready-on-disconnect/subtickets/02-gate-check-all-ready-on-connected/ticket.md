# Gate checkAllReady on connected players

`checkAllReady` must only consider connected players when deciding to start a run, and must require at least one connected player. This prevents a disconnected ghost with a stale `ready: true` from triggering deploy or blocking a stuck lobby.

## Acceptance Criteria

- In `checkAllReady` (`game/server/progression.js`), derive `connectedPlayers` as players where `p.connected !== false`.
- Start the run only when `connectedPlayers.length >= 1` **and** `connectedPlayers.every(p => p.ready)`.
- Disconnected players with `ready: true` do not satisfy the start condition (lobby stays in `lobby` phase).
- A lobby with one connected ready player and one disconnected not-ready player does not start until the connected player(s) are all ready.
- Add or extend a unit test in `game/server/test/server.test.js` under the existing `checkAllReady` describe: two players, one `connected: false` and `ready: true`, one `connected: true` and `ready: true` — `checkAllReady()` must **not** set `gamePhase` to `playing`.

## Technical Specs

- **File:** `game/server/progression.js`
- **Function:** `checkAllReady` (around lines 2935–2970)
- Replace `all.every(p => p.ready)` with filtering to connected players first, e.g.:
  ```js
  const connected = all.filter(p => p.connected !== false);
  if (connected.length > 0 && connected.every(p => p.ready)) { ... }
  ```
- **File:** `game/server/test/server.test.js`
- Add a focused `it(...)` case near other `checkAllReady` tests using `addPlayer` with explicit `connected` and `ready` overrides.

## Verification: code
