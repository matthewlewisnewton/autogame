# medic: heal button silently disabled when the player cannot afford it

## Difficulty: easy

## Goal

In the lobby Medic tab with HP 10/100 and Money 0, the cost line reads 'Full restore: 10 money' and the 'Heal to full' button is simply disabled with no explanation — no 'not enough money' message (the #medic-error element stays empty/hidden). At full HP the line helpfully changes to 'You are already at full health.', so the affordability case is the only one without feedback. Repro: die with 0 wallet money, return to lobby, open Medic tab. Expected: disabled-state reason shown ('Need 10 money — you have 0'), ideally with a partial-heal option.

## Acceptance Criteria

- When wallet < heal cost, the medic panel states the reason the button is disabled including the shortfall; message clears once affordable.

## Verification

Run the harness checks (vitest server+client) and verify the acceptance criteria above.
