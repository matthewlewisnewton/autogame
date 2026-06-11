# Post-death recovery — server revive floor and charity medic

## Description

Raise the lobby revive HP floor so a broke post-death player is not one grunt hit from dying again, and add a charity medic path so players with `currency < MEDIC_HEAL_COST` can still fully heal in the hub. Document the chosen mitigation in `game/docs/design.md` and cover it with server unit and integration tests.

## Acceptance Criteria

- `LOBBY_REVIVE_HP` in `game/server/config.js` is raised from `10` to `50` (50% of `MAX_HP`), and `revivePlayerInLobby()` continues to use that constant
- `healAtMedic()` in `game/server/progression.js` succeeds when the player is injured and `(player.currency || 0) < MEDIC_HEAL_COST`, charging `0` money and restoring HP to `MAX_HP` (paid medic behavior unchanged when the player can afford the cost)
- `game/docs/design.md` documents the death-spiral mitigation: 50% post-death lobby revive plus free charity medic when broke
- Unit tests in `game/server/test/server.test.js` and `game/server/test/sim_progression_helper_units.test.js` cover the new revive HP and charity-medic behavior (update the existing broke-player medic rejection test)
- A dedicated regression test (new file `game/server/test/death_spiral_recovery.test.js` or an added case in `game/server/test/integration.test.js`) proves: fresh 0-currency account dies → returns to lobby at `LOBBY_REVIVE_HP` → `medicHeal` restores to `MAX_HP` with `cost: 0` → redeploy starts a new run without immediate failure
- The regression test also asserts `LOBBY_REVIVE_HP` is at least `2 × ENEMY_DEFS.grunt.attackDamage` so a player who skips medic still has a realistic buffer against Initiate Vault grunts

## Technical Specs

- **`game/server/config.js`**
  - Change `LOBBY_REVIVE_HP` from `10` to `50`
  - Add a short comment tying the value to post-death survivability vs tier-1 grunt damage
- **`game/server/progression.js`**
  - In `healAtMedic()`: after the `already_full` guard, if `(player.currency || 0) < MEDIC_HEAL_COST`, skip the `insufficient_gold` rejection, set `cost = 0`, and heal to `MAX_HP`; otherwise keep the existing paid path (`player.currency -= cost`)
  - Return `{ ok: true, hp, currency, cost }` with `cost: 0` on charity heals
- **`game/docs/design.md`**
  - Add a short **Post-death recovery** subsection under durability / hub economy noting: run failure forfeits run earnings; lobby revive restores to 50% HP; broke players get a free charity medic full restore; paid medic (10 money) remains when funds are available
- **`game/server/test/server.test.js`**
  - Update `revivePlayerInLobby()` and `healAtMedic()` expectations for the new HP floor and charity path
- **`game/server/test/sim_progression_helper_units.test.js`**
  - Replace the broke-player `insufficient_gold` expectation with a charity-heal success case
- **`game/server/test/death_spiral_recovery.test.js`** (preferred) or **`game/server/test/integration.test.js`**
  - End-to-end socket flow for the 0-money death → lobby → charity medic → redeploy scenario described above
  - Import `LOBBY_REVIVE_HP`, `MAX_HP`, `MEDIC_HEAL_COST`, and `ENEMY_DEFS` as needed

## Verification: code
