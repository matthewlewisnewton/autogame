## revivePlayerInLobby runs on mid-run reconnect

`joinPlayerToLobby()` now calls `revivePlayerInLobby()` even when `gamePhase` is `playing`, so a player who dies mid-run, disconnects, and reconnects before returning to the hub receives `LOBBY_REVIVE_HP` (10) while still in the dungeon. This prevents persistence/reconnect soft-locks but could be exploited as a free mid-run heal. Consider gating the call to `isLobbyPhase(state)` or only reviving when the run is terminal/suspended.
### Acceptance Criteria
- Dead player reconnecting during an active `playing` run does not receive automatic HP restoration unless that is an explicit design choice
- Dead player reconnecting to hub lobby (or after a terminal run) still receives `LOBBY_REVIVE_HP`

## Document LOBBY_REVIVE_HP in design.md

`game/docs/design.md` describes hub HP recovery only via the Medic station. The new lobby-revive floor is intentional for the death soft-lock fix but is undocumented in the design doc.
### Acceptance Criteria
- `design.md` mentions `LOBBY_REVIVE_HP` as the automatic floor applied when returning to the hub after death or on reconnect with `hp <= 0`
- Medic station behavior (`MEDIC_HEAL_COST`, full heal to `MAX_HP`) remains documented separately
