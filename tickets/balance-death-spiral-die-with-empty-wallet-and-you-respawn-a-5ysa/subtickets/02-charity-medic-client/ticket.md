# Charity medic — client HUD for broke injured players

## Description

Update the lobby Medic tab so a player with 0 money and partial HP sees an enabled heal action instead of a permanently disabled button. Copy should reflect free charity triage when funds are below `MEDIC_HEAL_COST`, and paid pricing when the player can afford a normal restore.

## Acceptance Criteria

- `updateMedicHud()` in `game/client/main.js` enables `#medic-heal-btn` when the local player is not at full health and `currency < MEDIC_HEAL_COST` (charity path), not only when `currency >= MEDIC_HEAL_COST`
- When charity heal applies, `#medic-cost-display` shows free-triage copy (e.g. "Free triage restore — no money required") and the button label does not imply a 10-money charge
- When the player has enough money, existing paid medic copy and disable-at-full behavior are unchanged
- `game/client/socketHandlers/lobbyHandlers.js` error handling still surfaces server `medicError` messages; no new client-only block on charity heals
- Client tests in `game/client/test/` (add or extend an existing medic/HUD test file) assert the button is enabled for an injured 0-currency player and disabled at full health

## Technical Specs

- **`game/client/main.js`**
  - In `updateMedicHud()`: compute `canAffordMedic = currency >= MEDIC_HEAL_COST`; set `healBtnEl.disabled = atFull` (remove the `currency < MEDIC_HEAL_COST` disable condition for injured players)
  - Branch `#medic-cost-display` and `#medic-heal-btn` text:
    - `atFull` → unchanged "already at full health" copy
    - `!atFull && !canAffordMedic` → free charity triage strings
    - `!atFull && canAffordMedic` → existing paid `MEDIC_HEAL_COST` strings
- **`game/client/index.html`**
  - Only change default placeholder strings if needed for consistency; logic should be driven by `updateMedicHud()`
- **`game/client/socketHandlers/lobbyHandlers.js`**
  - Review `insufficient_gold` medic error mapping; charity heals should not hit this path, but keep the message for edge cases
- **`game/client/test/`**
  - Add a focused unit test (e.g. `medicHud.test.js` or extend an existing lobby HUD test) that calls `updateMedicHud()` with mocked DOM/state for: full HP + 0 currency (disabled), partial HP + 0 currency (enabled, free copy), partial HP + enough currency (enabled, paid copy)

## Verification: code
