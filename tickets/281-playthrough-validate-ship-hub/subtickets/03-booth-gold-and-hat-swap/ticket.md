# Character booth gold charge and free hat-swap assertions

Drive the hub character booth through a paid appearance change and a hat-only swap, asserting currency (gold) decreases only for the paid path. Capture booth screenshots for both flows.

## Acceptance Criteria

- `--steps booth` with `--preset hub` reaches the ship hub lobby (solo player is fine), requests debug scenario `hat-shop-currency` so currency is at least `APPEARANCE_CHANGE_COST` (25), and records `currencyBefore` from harness `currencyText` or an equivalent numeric probe.
- Paid appearance change: open the character booth (`window.openCharacterBooth()` or `?booth=character`), change a paid field (e.g. `bodyColor` to `#112233` via booth form controls or `applyAppearanceChange` test hook), confirm save, and assert `currencyAfter === currencyBefore - 25` (constant from `game/client/config.js` / `game/server/config.js`).
- Screenshot `game/validation/hub/05-booth-paid.png` captures the booth during or just after the paid save confirmation.
- Free hat-swap: request `hats-unlocked` (via `?booth=hatswap` on navigation or explicit `debugScenario` emit), open the booth, change **only** `hat` to an unlocked non-`none` id, save, and assert currency is unchanged (`currencyAfterHat === currencyBeforeHat`).
- Screenshot `game/validation/hub/06-hat-swap.png` captures the hat-swap save.
- `run-summary.json` records boolean assertions `boothDeductsGold` and `hatSwapFree` plus the observed currency deltas; step exits `0` only when both assertions are true.
- If the game deducts the wrong amount or charges for hat-only changes, exit non-zero and record the real values (do not coerce a pass).

## Technical Specs

- Edit: `harness/validate/playthrough.mjs` — implement `runBoothStep({ page, preset, outDirAbs })`; wire `--steps booth`.
- New (suggested): `harness/validate/lib/booth.mjs` — `grantHubCurrency(page)`, `openCharacterBooth(page)`, `savePaidAppearance(page, patch)`, `saveHatOnly(page, hatId)`, `readCurrency(page)` parsing `#currency-display` / harness `currencyText`.
- Preset constants: `currencyScenario: 'hat-shop-currency'`, `hatsScenario: 'hats-unlocked'` in `harness/validate/presets/hub.mjs`.
- Game references: `game/client/characterBooth.js` (`isPaidAppearanceChange`, `APPEARANCE_CHANGE_COST`), `game/shared/cosmeticAppearance.esm.js` (`hasAppearanceFieldChanges` — hat excluded), `game/server/socketHandlers/lobbyHandlers.js` (`applyAppearanceChange` charge path).
- Allowed minimal `game/client/main.js` change: add numeric `currency: myCurrency` to `__AUTOGAME_HARNESS_STATE__()` if DOM parsing is unreliable (prefer DOM first).

## Verification: code
