# 243-retire-2d-lobby-menus

## Difficulty: medium

## Goal

FINAL dependent ticket: remove the old 2D in-run-function lobby menus (quest/shop/deck/character/launch) now that booths cover them. KEEP the lobby-finder menu (matchmaking stays a menu). Keep every ?booth= debug hook as the test entry point.

## Acceptance Criteria

- 1. Remove the 2D quest/shop/deck/character/launch panels. 2. Lobby-finder menu remains. 3. ?booth= debug hooks remain functional. 4. All booth flows work end-to-end. 5. Tests green.

## Verification

Run the harness checks (vitest server+client) and verify the acceptance criteria above.
