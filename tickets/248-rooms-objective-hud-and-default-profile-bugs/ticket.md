# 248-rooms-objective-hud-and-default-profile-bugs

## Difficulty: easy

## Goal

Two real room-level bugs found in playtest.

## Acceptance Criteria

- (a) collect_items quests show 'Purged undefined/undefined hostiles' — game/client/main.js:1841 hardcodes the defeated-enemies string for every objective type; branch on obj.type. (b) string 'default' profile falls back to 'crowded' (real DEFAULT_LAYOUT_PROFILE unreachable) — fix or remove the dead alias. Tests for both.

## Verification

Run the harness checks (vitest server+client) and verify the acceptance criteria above.
