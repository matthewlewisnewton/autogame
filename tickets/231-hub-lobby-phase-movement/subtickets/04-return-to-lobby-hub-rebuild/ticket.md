# Return-to-lobby hub geometry rebuild

When a run ends and `gamePhase` returns to `lobby`, the client must rebuild hub
walkable geometry instead of keeping the dungeon layout from the finished run.
Today `stateUpdate` omits `layout` and the client overwrites the incoming lobby
snapshot with stale `currentLayout`, so `restoreHubLobbyScene` no-ops and lobby
movement stays bounded to dungeon meshes.

## Acceptance Criteria

- After `gamePhase` transitions from `playing` to `lobby` via `stateUpdate`
  (give-up, run complete, suspend, abandon, or equivalent server path), the
  client calls `rebuildDungeonLayout` with a layout whose `profile` is `hub`.
- `stateUpdate` no longer assigns the prior dungeon `currentLayout` onto the
  incoming lobby snapshot before hub rebuild runs.
- The server lobby re-entry snapshot exposes enough hub layout data for the
  client rebuild (include `layout` in `stateSnapshot()` when
  `gamePhase === 'lobby'`, or an equivalent targeted emission on return-to-lobby
  paths in `progression.js`).
- `game/client/test/hubLobbyScene.test.js` adds a case that simulates
  `playing` → `lobby` `stateUpdate` with hub layout and asserts
  `rebuildDungeonLayout` receives `profile: 'hub'` and local harness state
  matches.
- `cd game && pnpm test:quick` passes.

## Technical Specs

- `game/server/progression.js`:
  - Extend `stateSnapshot()` to include a deep-cloned `layout` when
    `_gameState.gamePhase === 'lobby'` (after `_applyHubLayout` has run on
    return-to-lobby paths such as `giveUpRun`, `returnPlayersToLobby`,
    `suspendRunToLobby`, and `abandonSuspendedRun`).
  - Keep omitting `layout` from playing-phase snapshots to avoid large dungeon
    payloads during runs.
- `game/server/test/server.test.js`:
  - Update the `stateSnapshot()` layout assertion: lobby-phase snapshots include
    hub `layout`; playing-phase snapshots still omit it.
- `game/client/main.js`:
  - In the `stateUpdate` handler, when `enteringLobby` is true, set
    `currentLayout` / `currentLayoutSeed` from `state.layout` /
    `state.layoutSeed` when present **before** calling `returnToGuildLobby`.
  - Do not overwrite `gameState.layout` with a non-hub `currentLayout` when
    entering lobby from playing.
  - Ensure `restoreHubLobbyScene` receives a state object that carries the hub
    layout (pass merged state or rely on updated `currentLayout`).
- `game/client/test/hubLobbyScene.test.js`:
  - Seed scene with hub join, switch harness state to `playing` with a dungeon
    layout, then fire `stateUpdate` with `gamePhase: 'lobby'` and hub `layout`;
    assert `rebuildDungeonLayout` is called once with `profile: 'hub'`.

## Verification: code
