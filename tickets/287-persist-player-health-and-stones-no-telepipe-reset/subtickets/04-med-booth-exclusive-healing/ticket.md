# Med booth as the only health restore path

Player health must persist continuously across hub ↔ sortie transitions; the **Medic station (med booth)** is the sole way to restore HP to full. Remove incidental healing on lobby return, telepipe suspend, and drop-in that bypass the med booth.

## Acceptance Criteria

- `healAtMedic()` continues to heal to `MAX_HP` and charge `MEDIC_HEAL_COST` currency (existing behavior).
- `revivePlayerInLobby()` no longer bumps HP to `LOBBY_REVIVE_HP` for living players with partial health; it must not act as a free heal.
- Telepipe suspend (`suspendRunToLobby`) does not increase `player.hp` or silently full-heal (`dead = false` is OK only if HP was already > 0; dead-at-0 players stay dead until medic).
- `initializePlayerForActiveRun()` does not set `player.hp = MAX_HP` unless joining with null/invalid HP on first init.
- New server tests:
  - Partial HP (e.g. 40) survives telepipe-up → hub → redeploy unchanged.
  - `healAtMedic` from hub restores to `MAX_HP`; partial HP without medic visit stays partial.
- `cd game && pnpm test:quick` passes.

## Technical Specs

- **`game/server/progression.js`** — narrow `revivePlayerInLobby()`; audit `suspendRunToLobby` player loop (~2716–2731) for HP/dead side effects; confirm `healAtMedic()` (~456) unchanged except docs.
- **`game/server/index.js`** — audit `joinPlayerToLobby` call to `revivePlayerInLobby` (~1152); audit `initializePlayerForActiveRun` HP branch (~1041).
- **`game/server/socketHandlers/lobbyHandlers.js`** — `MEDIC_HEAL` handler already wired; no change unless phase guard needs tweak.
- **`game/server/test/server.test.js`** — update `revives dead players to LOBBY_REVIVE_HP` test to match new policy; add telepipe HP persistence + medic heal tests.
- **`game/server/config.js`** — `LOBBY_REVIVE_HP` may become unused; remove constant only if all references gone.

## Verification: code
