# Fix multi-lobby cross-lobby leak and broken integration tests

> **Staleness note.** This follow-up ticket was written against commit
> `b299845` (2026-05-23). The codebase may have moved on since it was filed —
> before acting, re-check every file path and code reference below
> against the CURRENT code, and skip any nit that is already resolved.

The multi-lobby rework in `2fb2825` shipped with several correctness defects. The most serious is a cross-lobby state leak in the game loop's empty-lobbies fallback; alongside it the new lobby-join integration test references an undefined variable and passes mutually exclusive options so it never actually exercises a two-player lobby. Two damage-side issues (likely-unintended piercing on `throw_rock`, echo card MS-cost UI divergence) also need addressing.

## Difficulty: hard

## Code references

> The references in this section were reviewed at commit `b299845`; verify them against the current code before editing.

- `game/server/index.js` around `runGameLoopTick` (~line 875 in the commit diff) — when `lobbies._lobbies` is empty, the tick falls back to `[{ id: null, state: gameState }]` and then `io.emit('stateUpdate', ...)` (no room argument). This broadcasts the legacy singleton state to **every** connected socket — including sockets sitting in real lobbies that have not yet started. Real cross-session leak path.
- `game/server/test/integration.test.js:328-330` — references undefined `joined` variable: `expect(joined.lobbyId).toBe(first.init.lobbyId)`. Would throw `ReferenceError` on every run. The working tree fixes this to `second.init.lobbyId`; confirm the fix is committed and add coverage so the test actually asserts a successful join.
- Same test — passes `connectClient(baseUrl, 'guest-1', { skipLobby: true, joinLobbyId: first.init.lobbyId })`. The handler checks `if (options.skipLobby)` first, so `joinLobbyId` is dead. The "second player joins the lobby" test never has a second player in the lobby.
- `game/server/simulation.js:746` `collectProjectileHits` — samples along the path and tracks `hitEnemyIds`, but does not break the outer sample loop after the projectile makes its first contact. `arcane_bolt` and `throw_rock` both become piercing. If `throw_rock` (a desperation card) was never meant to pierce, this is a damage bug.
- `game/client/main.js` `useCard` — no longer consults `getCardDef`; relies entirely on `card.magicStoneCost` on the instance. Server-side `createEchoCard` may drop `magicStoneCost` when `def.magicStoneCost == null`, so echo cards can show "0 MS" client-side while the server still charges the original cost.
- `game/server/progression.js:2058` `getIoTarget` / `_getIo` — `returnPlayersToLobby` (~line 2149) emits via this helper, which scopes to `_gameState._lobbyId`. Safe inside `withLobbyContext`, but silently emits to the legacy singleton if ever called outside one. Add an assertion or a non-optional lobby argument.

## Acceptance Criteria

- The empty-lobbies fallback in `runGameLoopTick` does **not** broadcast state to sockets that belong to real lobbies. Either remove the legacy singleton fallback entirely (preferred) or scope its `io.emit` to a dedicated room that only sockets opting into the legacy game state ever join.
- The "second player joins from lobby list" integration test:
  - References only variables it actually defines.
  - Connects the second client **without** `skipLobby` so the lobby join path is exercised.
  - Asserts both players are in the same lobby's state.
- `collectProjectileHits` exposes piercing as an explicit per-card option (e.g., `card.projectile.pierces === true`); `throw_rock` defaults to single-target unless its design doc says otherwise. Add a regression test that fires `throw_rock` through a line of enemies and asserts only the first is hit.
- Echo cards consistently expose `magicStoneCost` to the client, or client `useCard` falls back to `getCardDef(card.id)` when the field is missing. Add a test that creates an echo of a non-zero-cost card and asserts client-side cost matches server-side charge.
- `returnPlayersToLobby` is guarded against being called outside a lobby context (throw, or take an explicit lobby argument).

## Technical Specs

- Likely files: `game/server/index.js`, `game/server/progression.js`, `game/server/simulation.js`, `game/server/test/integration.test.js`, `game/client/main.js`, `game/server/lobbies.js`.
- Cross-lobby leak: the cleanest fix is to delete the `[{ id: null, state: gameState }]` fallback now that lobbies are mandatory; if any code path still depends on the legacy singleton, audit and migrate those callers in the same change.
- For echo `magicStoneCost`: prefer fixing the server so echo cards carry the originating def's MS cost explicitly, rather than relying on client lookup, so anti-cheat and UI stay aligned.

## Verification: code
