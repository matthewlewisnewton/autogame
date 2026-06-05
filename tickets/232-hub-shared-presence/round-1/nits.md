## Document Hub Presence Socket Event

`game/docs/lobbies.md` documents the lobby socket events but does not list the new `hubPresenceUpdate` server-to-client event. Adding it would keep the architecture docs aligned with the live API and make future client/server work easier to discover.

### Acceptance Criteria
- `game/docs/lobbies.md` lists `hubPresenceUpdate` in the server-to-client events table with its lobby-phase timing and `{ lobbyId, revision, players }` payload shape.
