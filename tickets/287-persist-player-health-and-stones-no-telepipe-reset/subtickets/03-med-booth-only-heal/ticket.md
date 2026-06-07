# 03 — Med booth is the only full-heal source

Confirm and enforce that the hub Medic station (`healAtMedic`) is the **only** path that restores a living player's health to full. Hub-return and lobby-revive helpers must not grant unsolicited healing to players who still have partial HP.

## Acceptance Criteria

- `healAtMedic` still sets `player.hp = MAX_HP`, deducts `MEDIC_HEAL_COST` currency, and rejects `already_full` / `insufficient_gold` / `not_in_lobby` as today.
- `revivePlayerInLobby` no longer bumps HP for living players with partial health (e.g. do not raise 42 HP toward `LOBBY_REVIVE_HP` or `MAX_HP`). It may still clear `dead` and set a minimal HP only when `hp <= 0` so the player is interactable in the hub — but must not act as a full heal.
- Telepipe hub-return path (refactored in sub-ticket 02) leaves partial `hp` untouched on extracted players.
- `returnPlayersToLobby` / `giveUpRun` / run-failure paths do not restore partial HP; only med booth can bring a living player to `MAX_HP`.
- Unit tests in `game/server/test/server.test.js`: partial-HP player survives hub return without HP increase; `healAtMedic` restores to `MAX_HP`.

## Technical Specs

- **`game/server/progression.js`** — Tighten `revivePlayerInLobby` (~line 447); audit `suspendRunToLobby`, `returnPlayersToLobby`, `giveUpRun`, and `abandonSuspendedRun` remnants for any HP writes beyond the minimal dead-player case.
- **`game/server/socketHandlers/lobbyHandlers.js`** — `MEDIC_HEAL` handler unchanged except if lobby-phase checks need adjustment after checkpoint removal.
- **`game/server/test/server.test.js`** — Extend `healAtMedic()` describe block; add test that partial HP persists through telepipe hub return (can build on sub-ticket 02 helpers).

## Verification: code
