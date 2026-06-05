# 241-free-hat-swap

## Difficulty: medium

## Goal

Equip any UNLOCKED hat for FREE — at the character booth AND from the main menu (no gold). Unlocking new hats stays paid (existing unlockHat). Debug hook to open hat-swap directly.

## Acceptance Criteria

- 1. Swapping to an unlocked hat is free, from booth + main menu. 2. Equipping verifies the hat is unlocked (depends on the sec-hat-equip-unlock-check fix). 3. Test.

## Verification

Run the harness checks (vitest server+client) and verify the acceptance criteria above.
