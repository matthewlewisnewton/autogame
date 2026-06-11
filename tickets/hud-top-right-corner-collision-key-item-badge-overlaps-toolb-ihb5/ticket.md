# hud: top-right corner collision — key-item badge overlaps toolbar buttons; lock-on panel overlaps comms log

## Difficulty: easy

## Goal

Three HUD systems fight over the top-right corner: (1) the key-item HUD badge ('Dodge Roll / E') renders ON TOP of the app toolbar buttons (calibration/antenna and settings icons are half-covered in every in-run screenshot at 1280x800); (2) when lock-on is active, the lock-on info panel draws over the quest comms log, making both unreadable; (3) at level entry the quest banner toast overlaps the comms log text behind it. Repro: launch any run with the default dodge_roll key item equipped and look top-right; press Z near an enemy while a comms message is visible. Expected: top-right elements stack vertically (toolbar, then key-item badge, then lock-on panel / comms) or move the key-item badge next to the card hand.

## Acceptance Criteria

- At 1280x800 (and 1920x1080) no top-right HUD element overlaps another: toolbar buttons fully clickable with key item equipped, lock-on panel and comms log both readable simultaneously.

## Verification

Run the harness checks (vitest server+client) and verify the acceptance criteria above.
