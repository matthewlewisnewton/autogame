# 252-enemy-lockon-info-panel

## Difficulty: medium

## Goal

When locked on, show a small HUD panel with the target's name + key stats (HP/max, attack damage, speed, variant) + description. Builds on the unified lock-on (219) + enemy-display-metadata (251).

## Acceptance Criteria

- Lock-on shows a panel with name/stats/description from 251; updates with target HP; hides when unlocked. Test.

## Verification

Run the harness checks (vitest server+client) and verify the acceptance criteria above.
