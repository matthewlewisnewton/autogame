# 04 — Registry extensibility and quest alignment tests

Prove the registry pattern: adding a hypothetical fourth objective type is a single `OBJECTIVE_DEFS` entry, and every live quest `objectiveType` is covered. Remove any remaining `objectiveType` / `objective.type` switches in `progression.js` that duplicate registry knowledge (if any were left after 01–03).

## Acceptance Criteria

- `game/server/test/server.test.js` (or a focused `objectives.test.js`) includes a test that registers a minimal fake objective type on `OBJECTIVE_DEFS` (or a test-only clone), calls `createObjective` + `isComplete` + progress/spawn no-ops, and asserts completion without editing `createRunState` if-chains (there should be none left).
- `QUEST_DEFS` test block asserts every `quest.objectiveType` in `game/server/quests.js` has a matching `OBJECTIVE_DEFS` key (fail fast when a quest references an unregistered type).
- Grep of `game/server/progression.js` shows no remaining `objectiveType ===` or `objective.type ===` conditionals except registry dispatch or comments.
- `pnpm test:quick` passes for the full server suite touched by quest/run tests.

## Technical Specs

- **Change** `game/server/test/server.test.js` (or **add** `game/server/test/objectives.test.js`) — extensibility + alignment tests.
- **Change** `game/server/objectives.js` — export `OBJECTIVE_DEFS` for tests if not already; document one-entry add pattern in a brief module header comment.
- **Change** `game/server/progression.js` only to delete any straggler type switches found during the grep audit.

## Verification: code
