# Wire LOBBY_REVIVE_HP into revivePlayerInLobby()

## Description

`LOBBY_REVIVE_HP = 10` is defined in `game/server/config.js` but never used. The `revivePlayerInLobby()` function in `game/server/progression.js` clears the `dead` flag for players returning to the lobby after a failed run, but leaves their HP at 0. This causes an infinite loop: die → return to lobby at 0 HP → redeploy → instant "Signal Lost" because `checkRunTerminalState()` sees all players at `hp <= 0`.

Fix: when `revivePlayerInLobby()` revives a dead or 0-HP player, restore their HP to `LOBBY_REVIVE_HP` instead of leaving it at 0.

## Acceptance Criteria

- `revivePlayerInLobby()` imports and uses `LOBBY_REVIVE_HP` from `config.js`
- When reviving a player with `hp <= 0` (dead or alive-but-zero), HP is set to `LOBBY_REVIVE_HP` (10) instead of staying at 0
- Players with `hp > 0` and `dead: false` are left unchanged (early-return path)
- A fresh account that dies at 0 money can return to the lobby with 10 HP and successfully deploy into a new run without immediate failure

## Technical Specs

- **File**: `game/server/progression.js`
  - Add `LOBBY_REVIVE_HP` to the existing import from `./config` (line ~10-20)
  - Modify `revivePlayerInLobby()` (line ~452): after clearing `player.dead = false`, set `player.hp = LOBBY_REVIVE_HP` for players whose HP was 0 or who were dead
  - The function currently reads:
    ```js
    function revivePlayerInLobby(player) {
      if (!player) return;
      const hp = Number.isFinite(player.hp) ? player.hp : 0;
      if (!player.dead && hp > 0) return;
      player.dead = false;
    }
    ```
  - Change to set `player.hp = LOBBY_REVIVE_HP` when the early-return guard doesn't fire (i.e., when the player IS dead or has hp <= 0)

## Verification: code
