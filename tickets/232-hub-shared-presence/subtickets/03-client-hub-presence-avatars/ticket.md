# Client: render remote hub avatars from hub presence

Consume `hubPresence` / `hubPresenceUpdate` during the lobby phase so
party-mates' cosmetic avatars appear in the shared hub and follow server
positions. Reuse the existing renderer remote-player path; do not add a second
avatar system.

Depends on sub-ticket 02.

## Acceptance Criteria

- `applyLobbyJoinedData` (or equivalent lobby-join path) applies `data.hubPresence`
  into the client's `gameState.players` for every remote entry (merge position,
  rotation, cosmetic, username; do not wipe the local player's prediction fields).
- A `hubPresenceUpdate` socket handler merges `presence.entries` into
  `gameState.players` while `gamePhase === 'lobby'` and removes meshes for ids
  listed in `removedPlayerIds` (dispose avatar + nameplate, same as
  `playerDisconnected`).
- While in the hub lobby phase, when a remote entry's `x`/`z` (and `y`) change
  across updates, the renderer positions that player's mesh on the next
  `animate()` frame (no deploy / no playing-phase-only guard blocking remotes).
- Remote avatars use each entry's `cosmetic` (non-default colors/shape/hat when
  present in the payload).
- Local player movement remains client-predicted; remote players are
  server-authoritative from presence only.
- Client vitest: with hub layout + lobby phase `gameState`, two player entries
  (local + remote) produce two entries in `playersMeshes`, and updating the
  remote entry's coordinates moves the remote mesh.

## Technical Specs

- `game/client/main.js`:
  - Register `s.on('hubPresenceUpdate', ...)`.
  - Add `applyHubPresence(presence, { removedPlayerIds })` that merges into
    `gameState.players` and calls `setGameStateRef(gameState)`.
  - In `applyLobbyJoinedData`, call `applyHubPresence(data.hubPresence)` when
    present.
- `game/client/renderer.js` — only change if needed: the existing loop over
  `gs.players` (skip `id === myId` for position) should drive remotes; fix any
  lobby-phase early-continue that prevents remote mesh creation/update.
- `game/client/test/hub-presence-avatars.test.js` (new) — renderer mock pattern
  from `hub-lobby-render.test.js` / `avatar-cosmetic-render.test.js`; drive
  `setGameStateRef` + `animate` with two lobby players.
- Do not change `#lobby` overlay layout; canvas may remain behind the UI — this
  ticket is networked avatar sync only.

## Verification: code
