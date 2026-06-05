## Document Hub Presence In Lobby Object Shape
`game/docs/lobbies.md` documents the lobby object shape but still lists only `id`, `name`, `state`, and `createdAt`. Since this ticket adds `hubPresence` as owned lobby state, the schema snippet should include it for future maintainers.
### Acceptance Criteria
- `game/docs/lobbies.md` includes `hubPresence` in the documented lobby object shape.
