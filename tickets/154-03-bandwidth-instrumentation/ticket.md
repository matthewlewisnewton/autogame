# Bandwidth instrumentation + many-entity load scenario

## Difficulty: medium
## Verification: code
## Depends on: none

## Goal
Make state-sync bandwidth measurable, and provide a heavy scenario to measure it
against — the baseline the whole epic is judged by.

## Acceptance Criteria
- A counter sums serialized `stateUpdate` bytes emitted per second (per lobby),
  exposed via a log line and/or a debug endpoint — off the hot path / cheap.
- A debug scenario (server `DEBUG_SCENARIOS` + `?debugScenario=` gate, dev-only)
  spawns a large, deterministic set of entities (e.g. N enemies + loot) so
  bandwidth is reproducible and QA-able.
- Same state must still be reachable through normal play (scenario is a
  shortcut, not a new code path).

## Technical Specs
- `game/server/index.js`: byte-count around the `stateUpdate` emit; register the
  load scenario alongside existing ones (search `summon-low-mana`).

## Verification: code
- The scenario spawns the entities; the counter reports bytes/sec. Capture a
  baseline number for the full-snapshot encoding (used by 154-11).
- `pnpm test:quick` green.
