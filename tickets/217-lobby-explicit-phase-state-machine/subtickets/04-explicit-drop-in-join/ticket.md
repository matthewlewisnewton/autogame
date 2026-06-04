# 04 — Explicit join-in-progress (drop-in) policy

Make mid-run `joinLobby` intentional instead of accidental: document and branch on `PHASES.PLAYING` at the socket handler before `joinPlayerToLobby`, keeping **drop-in allowed** (current product behavior). Add a focused test so regressions emit `lobbyError` only for real validation failures, not silent policy drift.

## Acceptance Criteria

- **Depends on** sub-ticket `03-server-phase-guards` (`.passed`).
- `joinLobby` handler (`game/server/index.js` ~1158–1180) has an explicit branch when target lobby `isPlayingPhase(lobby.state)`: comment + named helper (e.g. `allowDropInJoin(lobby)` returning true) before calling `joinPlayerToLobby` — not an implicit fall-through inside `joinPlayerToLobby` alone.
- Policy: **allow** drop-in while `gamePhase === playing` (do not reject with `lobbyError` for in-run lobbies). Joining a lobby in `PHASES.LOBBY` with `suspendedCheckpoint` remains a normal lobby join (no active dungeon).
- `joinPlayerToLobby` drop-in setup (`initializePlayerForActiveRun` when playing) is reachable only through the documented playing-phase path.
- `game/docs/lobbies.md` “Drop-in during an active run” section references `PHASES.PLAYING` and the explicit handler branch.
- New or extended test: third player (or reconnecting player) `joinLobby` on a lobby already in `playing` receives `lobbyJoined` with `gamePhase: 'playing'` and initialized hand/deck — e.g. extend `server/test/integration.test.js` or add a case beside existing mid-run persistence tests.
- `pnpm test:smoke:lobby-dropin` and `pnpm test:quick` pass.

## Technical Specs

- **`game/server/index.js`**: Refactor `socket.on('joinLobby')` to call something like `joinLobbyWithPhasePolicy(socket, lobby)` that checks `isPlayingPhase` and documents allow-vs-reject; implement allow (current behavior).
- **`game/server/index.js`**: Optionally extract `handleDropInJoin(socket, lobby)` from the `joinPlayerToLobby` playing branch for clarity.
- **`game/docs/lobbies.md`**: Update drop-in section to point at the explicit policy function.
- **`game/server/test/integration.test.js`** (or **`game/server/test/lobbies.test.js`** with mocked state): Assert playing-phase join succeeds and sets player run fields via `initializePlayerForActiveRun`.

## Verification: code
