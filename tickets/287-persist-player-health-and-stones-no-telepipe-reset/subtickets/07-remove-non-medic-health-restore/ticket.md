# 07 — Remove health restoration outside the med booth

Sub-ticket 03 tightened lobby revive for living partial-HP players, but dungeon auto-respawn and dead-player lobby revival still raise HP without visiting the hub Medic station. Remove or redesign those paths so `healAtMedic()` is the only way to restore health to full (or above minimal interactability for dead players at 0 HP in the hub).

## Acceptance Criteria

- `damagePlayer()` in dungeon no longer schedules a timed respawn that sets `hp = MAX_HP`. Dead players remain dead (or at 0 HP) until telepipe extract, run end, or med booth — no automatic full heal in-combat.
- `revivePlayerInLobby()` does not assign `LOBBY_REVIVE_HP` as a heal. It may clear `dead: false` and leave HP at its current value (including 0) so hub UI remains usable; it must not raise partial or zero HP toward `LOBBY_REVIVE_HP` or `MAX_HP`.
- `returnPlayersToLobby()`, `giveUpRun()`, and `joinPlayerToLobby()` do not increase HP for living or dead players except via the minimal dead-flag clear above.
- `healAtMedic()` remains the sole path that sets `hp` to `MAX_HP`.
- Unit tests updated: remove expectations that `damagePlayer` auto-respawns to full HP; remove expectations that `returnPlayersToLobby` sets `LOBBY_REVIVE_HP`; add test that partial-HP player survives run-failure return unchanged; add test that med booth heals a dead-or-zero-HP hub player to `MAX_HP`.

## Technical Specs

- **`game/server/simulation.js`** — Remove or replace the `setTimeout` respawn block in `damagePlayer()` (~line 2083) that sets `p.hp = MAX_HP`. Keep death flagging and position reset only if still required for gameplay flow without healing.
- **`game/server/progression.js`** — Revise `revivePlayerInLobby()` (~line 447) to stop writing `LOBBY_REVIVE_HP`; audit `returnPlayersToLobby`, `giveUpRun`, and `suspendRunToLobby` for any remaining HP writes.
- **`game/server/index.js`** — Confirm `joinPlayerToLobby()` (~line 1157) calls the revised revive helper without side-effect healing.
- **`game/server/test/server.test.js`** — Update `damagePlayer` respawn tests and `returnPlayersToLobby` / `revivePlayerInLobby` describe blocks to match med-booth-only healing policy.
- **`game/server/test/integration.test.js`** — Adjust any integration tests that assumed auto-respawn or lobby revive HP restoration.

## Verification: code
