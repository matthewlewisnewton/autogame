# Lobby: interact (F key AND all gamepad buttons) does nothing — can't interact with booths in main lobby

## Difficulty: medium

## Goal

In the main lobby/hub, pressing the interact key F (keyboard) does nothing, and no gamepad button interacts either — the player cannot interact with hub booths (deck/shop/launch bay/quest board). The interact action is bound to 'f' (game/client/input.js:54, action handled ~input.js:131) and hub booth interaction is wired via game/client/boothPrompt.js (dispatchBoothAction / BOOTH_ACTION_EVENT / updateBoothPrompt) and main.js ~1279 ('Hub booth interaction — not gated behind canUseGameActions so it fires in lobby'). Something in this chain is broken: either the interact keybinding no longer dispatches the booth action, the booth prompt isn't appearing/arming when near a booth, or a gate (canUseGameActions / lobby state) is wrongly blocking it. REPRO: enter the main lobby, walk up to a booth, press F (and try gamepad buttons) — nothing happens. EXPECTED: the booth prompt arms and F (or the bound gamepad button) opens the booth. Investigate the interact->boothPrompt->dispatchBoothAction wiring and whether updateBoothPrompt detects proximity. NOTE: reported on macOS Safari — verify whether it also repros in Chrome (if Safari-only, may relate to the gamepad/Safari bug) or is a general regression. Verify via code + the boothPrompt unit/integration path.

## Acceptance Criteria

- Pressing the interact key (F) while near a hub booth in the lobby opens that booth; the bound gamepad button does the same; the booth prompt arms on proximity. Covered by a test of the interact->booth dispatch path. Confirm whether it was browser-specific.

## Verification

Run the harness checks (vitest server+client) and verify the acceptance criteria above.
