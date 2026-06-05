# Deliver the hub layout to lobby clients

The client cannot render the hub during the lobby phase because the server only
sends the quest dungeon layout. Deliver the existing `generateHub` layout to
clients in the `lobbyJoined` payload so the client can render it during
`gamePhase === 'lobby'`.

## Acceptance Criteria

- The `lobbyJoined` payload sent to a joining client includes a `hubLayout`
  field separate from the existing `layout` (quest) field.
- `hubLayout` is a `profile: 'hub'` layout produced by `generateHub` with the
  three named zone rooms (`operations`, `commerce`, `salon`), the connecting
  `passages`, and the named `boothAnchors` (`quest`, `launch`, `shop`, `deck`,
  `character`, `hats`).
- The delivered hub layout has walkable collision geometry like other stages:
  `computeWalkableAABBs(hubLayout)` returns a non-empty array and the rooms
  carry wall definitions.
- Delivering the hub layout does not change the existing quest `layout` /
  `layoutSeed` fields, and does not bloat every per-tick `stateUpdate`
  broadcast (it is sent once at join, like `layout`).
- A server unit test asserts the above (hub layout present, `profile: 'hub'`,
  named zones + booth anchors, walkable AABBs non-empty).

## Technical Specs

- `game/server/index.js`:
  - Add `generateHub` (and, if used by the test/assert path,
    `computeWalkableAABBs`) to the existing `require('./dungeon')` destructure
    near the top.
  - The hub layout is deterministic, so build it once at module load
    (e.g. `const HUB_LAYOUT = generateHub(0);`) rather than per-join.
  - In `emitLobbyJoined(...)` add `hubLayout: HUB_LAYOUT` to the object passed
    to `socket.emit('lobbyJoined', { ... })`. Leave `layout` / `layoutSeed`
    unchanged.
- `game/server/test/` — add a new test file (e.g. `hub_client_payload.test.js`)
  that imports `generateHub` / `computeWalkableAABBs` from `../dungeon` and
  asserts the hub layout shape (profile, zone rooms via `hubZone`, booth anchor
  keys, passages length, and `computeWalkableAABBs(...).length > 0`). If
  feasible, also assert that an emitted `lobbyJoined` payload carries a
  `hubLayout`; otherwise assert against the exported `HUB_LAYOUT`/`generateHub`
  result directly.
- Do NOT change `buildPlayerRecord` spawn coordinates or `firstRoomPosition`;
  the client derives the hub spawn from the layout's `role: 'start'` room.

## Verification: code
