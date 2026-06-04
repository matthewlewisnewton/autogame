# 01 — Remove dead `hostId` from server lobby code

Strip the unused `hostId` field from the in-memory lobby model, stop reassignment on leave, drop it from `lobbySummary`, and simplify `createLobby` so it no longer takes a host player id. Update the `createLobby` socket handler call site. Behavior stays “any lobby member can act”; this only deletes ceremony.

## Acceptance Criteria

- `game/server/lobbies.js` lobby objects have no `hostId` property; `createLobby` accepts only an optional lobby name (same trimming/default naming as today).
- `removePlayerFromLobby` contains no host-reassignment branch or `hostChanged`-related comments.
- `lobbySummary` / `listLobbySummaries` payloads omit `hostId`.
- `game/server/index.js` `createLobby` handler calls the new `createLobby` signature (creator is still joined via `joinPlayerToLobby`; no host id stored).
- `rg 'hostId' game/server` matches only unrelated strings (if any); no `lobby.hostId` or summary `hostId` remains.
- `pnpm test:quick` (from `game/`) passes.

## Technical Specs

- **`game/server/lobbies.js`**
  - Remove `hostId` from the object literal in `createLobby`.
  - Change `function createLobby(hostId, name)` to `function createLobby(name)` (preserve name trim/slice/default logic).
  - Delete the `if (lobby.hostId === playerId) { … }` block in `removePlayerFromLobby`.
  - Remove `hostId: lobby.hostId` from `lobbySummary`.
- **`game/server/index.js`**
  - In the `socket.on('createLobby', …)` handler (~line 1177), call `lobbies.createLobby(data && data.name)` instead of passing `playerId` as the first argument.
- **`game/server/test/lobbies.test.js`**
  - Drop assertions on `lobby.hostId` and `hostId` in summary `toMatchObject`.
  - Remove the test *“removePlayerFromLobby reassigns host when host leaves with others present”*; keep coverage that non-host leave with others present does not delete the lobby and removes the player.
  - Update all `createLobby('host-1', …)` / `createLobby('host-1')` calls to the new arity (`createLobby('Test Room')`, `createLobby()`, etc.).
- **`game/server/test/server.test.js`**
  - Update the lone `createLobby('host-1', 'Tick Test')` call to `createLobby('Tick Test')` (or equivalent).

## Verification: code
