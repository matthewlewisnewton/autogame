# Medic panel shortfall message when wallet cannot afford full restore

## Description

After charity medic shipped, an injured player with `currency < MEDIC_HEAL_COST` can heal for free, but the Medic tab still fails to explain *why* the paid restore is unavailable. Update `renderGuildMedic()` so the cost line states the shortfall (need vs. have) while keeping the charity heal button enabled. When the player can afford the paid restore, the shortfall copy must disappear and the normal paid pricing line returns.

## Acceptance Criteria

- With partial HP and `currency < MEDIC_HEAL_COST` (e.g. HP 10/100, money 0), `#medic-cost-display` shows a shortfall message that includes both the heal cost and the player's current wallet (e.g. `Need 10 money — you have 0`), and notes that free triage is available
- `#medic-heal-btn` stays **enabled** on the charity path (injured + broke); only full-health players have a disabled heal button
- When `currency >= MEDIC_HEAL_COST` and not at full HP, `#medic-cost-display` shows the normal paid line (`Full restore: 10 money`) with no shortfall text
- `#medic-error` remains empty/hidden during normal HUD renders (socket error handling unchanged)
- `game/client/test/medicHud.test.js` asserts the shortfall copy for broke injured players and that paid copy returns once affordable

## Technical Specs

- **`game/client/main.js`** — `renderGuildMedic()` (~2986–3025)
  - In the `!atFull && !canAffordMedic` branch of `#medic-cost-display`, replace the current lone free-triage string with copy that includes the numeric shortfall, e.g. `` `Need ${MEDIC_HEAL_COST} money — you have ${currency}. Free triage available.` `` (use `formatCurrencyPrice(MEDIC_HEAL_COST)` for the cost token if that matches surrounding paid copy)
  - Keep `healBtnEl.disabled = atFull` — do **not** re-disable the button when broke
  - Keep `showMedicError('')` at the end so affordability hints live in `#medic-cost-display`, not `#medic-error`
  - Leave the paid (`canAffordMedic`) and at-full branches unchanged aside from any shared formatting tweaks
- **`game/client/test/medicHud.test.js`**
  - Update the existing `'enables heal with free triage copy when injured and broke'` case to expect the shortfall text (need + have) plus free-triage availability
  - Add or extend a case where `currency >= MEDIC_HEAL_COST` confirms `#medic-cost-display` does **not** contain shortfall wording
- **No server changes** — `healAtMedic()` charity behavior in `game/server/progression.js` is already correct

## Verification: code
