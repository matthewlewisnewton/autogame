# Global lobby browser aggregated across instances

Each instance publishes its local `listLobbySummaries()` snapshot to Redis; browser-facing code reads the union of all instance snapshots so clients on any node see lobbies created on other nodes. When Redis is disabled, `listLobbySummaries()` behavior remains exactly as today (local lobbies only).

## Acceptance Criteria

- `game/server/lobbyBrowser.js` exports `publishLocalLobbies()`, `listGlobalLobbySummaries()`, and `resetLobbyBrowserForTests()`
- After any lobby list change (create, join, leave, disconnect, phase/startGame, reaper delete), `publishLocalLobbies()` writes JSON summaries to key `lobbies:<instanceId>` with a TTL (e.g. 30s) refreshed on each publish; stale instance keys are ignored when aggregating
- `listGlobalLobbySummaries()` returns local summaries merged with remote instance snapshots, deduped by `lobby.id`, excluding ghost lobbies (`playerCount === 0`) and expired instance keys
- `broadcastLobbyList()`, `init` payload `lobbies`, `listLobbies` handler, and `lobbyLeft` payload use `listGlobalLobbySummaries()` instead of raw `lobbies.listLobbySummaries()` when Redis is enabled; when disabled, delegate to existing `listLobbySummaries()` unchanged
- Optional: each summary may include `instanceId` of the owning instance (from registry or publisher) for future routing; must not break client `renderLobbyList` (unknown fields are ignored)
- `game/server/test/global_lobby_browser.test.js` simulates two instance IDs publishing different lobbies and asserts the aggregator returns both; with Redis disabled, output matches `listLobbySummaries()` alone
- Parent acceptance: with Redis enabled in test shim, lobbies from a second mock publisher appear in `lobbyListUpdate` / `init.lobbies`; with `REDIS_URL` unset, full vitest suite behavior matches pre-ticket baseline

## Technical Specs

- **New file:** `game/server/lobbyBrowser.js`
  - `publishLocalLobbies()`: `SET lobbies:<instanceId> JSON.stringify(lobbies.listLobbySummaries()) EX <ttl>`
  - `listGlobalLobbySummaries()`: read local list, scan/read other `lobbies:*` keys (maintain a `instances:active` set updated on publish, or `SCAN lobbies:*`), merge arrays, dedupe by `id`, sort consistently (e.g. by `name`)
  - Call `publishLocalLobbies()` from a single choke point to avoid drift
- **File:** `game/server/index.js`
  - Replace `broadcastLobbyList()` body to emit `{ lobbies: await listGlobalLobbySummaries() }` (or sync equivalent)
  - Update `init` connection payload `lobbies` field similarly
- **File:** `game/server/socketHandlers/lobbyHandlers.js`
  - `LIST_LOBBIES` handler and `LOBBY_LEFT` payload use global list helper
  - Ensure `publishLocalLobbies()` runs after join/create/leave paths (may be invoked inside `broadcastLobbyList()`)
- **File:** `game/server/lobbies.js` — no change to summary shape in `lobbySummary()` unless adding `instanceId`
- **New file:** `game/server/test/global_lobby_browser.test.js`
- **Docs (optional, only if harness requires):** one-line note in `game/docs/lobbies.md` under Future work → implemented global browser when `REDIS_URL` set

## Verification: code
