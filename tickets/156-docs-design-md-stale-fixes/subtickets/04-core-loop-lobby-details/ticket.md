# Core loop: fix lobby browser field description

The Core Loop section says the lobby browser shows "(name, player count, dungeon, in-run vs waiting)" — but the lobby summary has no "dungeon" field. Correct the listed fields to match the actual `lobbySummary()` output.

## Acceptance Criteria

- The lobby browser description is corrected to list the actual fields from `lobbySummary()`: `id`, `name`, `hostId`, `gamePhase`, `selectedQuestId`, `playerCount`, `players`.
- The misleading "dungeon" field reference is removed or replaced with "selected quest" (which maps to `selectedQuestId`).
- "in-run vs waiting" should be clarified as `gamePhase` ('lobby' vs 'playing').

## Technical Specs

- Edit only `game/docs/design.md`.
- Section: **Core Loop** (Lobby browser bullet).
- Cross-check against `game/server/lobbies.js` `lobbySummary()` function to verify actual fields.

## Verification: code
