# 270-difficulty-scale-with-player-count

## Difficulty: medium

## Goal

Above 4 players (up to the 16 cap), small marginal per-player increase to enemy spawn rate + enemy damage; minibosses spawn with slightly more HP per player. 1-4 players keep baseline. Tuning consts in config.

## Acceptance Criteria

- Each player 5..16 adds a small increment to spawn rate + enemy damage; miniboss HP scales by party-size at spawn. SEPARATE automated tests per component exercising mid-run JOIN and LEAVE: spawn rate + enemy damage track the live count up/down; miniboss HP is set at spawn (not retroactive); the count the scaling reads stays correct under churn.

## Verification

Run the harness checks (vitest server+client) and verify the acceptance criteria above.
