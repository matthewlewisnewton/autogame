# 267-sec-hat-equip-unlock-check

## Difficulty: easy

## Goal

cosmetic.js:101-103 validates only that an equipped hat is a known catalog id, not that the account UNLOCKED it -> equip any paid hat for free via profile update.

## Acceptance Criteria

- Equipping a hat verifies it is in the account unlockedHats; reject otherwise. Test for equip-locked-hat rejection.

## Verification

Run the harness checks (vitest server+client) and verify the acceptance criteria above.
