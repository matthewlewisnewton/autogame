# 02 — Align lobby docs with no-host model

Update lobby architecture docs so they no longer describe `hostId`, host reassignment, or host-only quest control. Depends on sub-ticket 01 (server and tests already green).

## Acceptance Criteria

- `game/docs/lobbies.md` documents `createLobby(name?)` without a host parameter and omits `hostId` from the lobby object shape.
- `game/docs/gameplay-review.md` no longer refers to `hostId` in the create-lobby flow and does not claim only the lobby host’s quest choice applies (any member may select quest while in lobby phase, matching server behavior).
- `rg 'hostId' game/docs` has no matches (unless quoting this removal in a changelog — prefer zero matches).

## Technical Specs

- **`game/docs/lobbies.md`**
  - In the exports table, change `createLobby(hostId, name?)` to `createLobby(name?)`.
  - In the lobby object example, remove the `hostId` field and its “reassigns to next player” comment.
- **`game/docs/gameplay-review.md`**
  - Revise the **Create** bullet so it describes `lobbies.createLobby(name)` and joining the creator via `joinPlayerToLobby`, without “host” terminology for lobby ownership.
  - Delete or rewrite the sentence *“Only the lobby host's quest choice applies to the shared run until deploy.”* to state that any connected lobby member can change the selected quest while `gamePhase === 'lobby'` (subject to suspended-run guards documented elsewhere).

## Verification: code
