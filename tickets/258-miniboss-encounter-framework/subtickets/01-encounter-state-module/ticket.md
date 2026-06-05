# 01 — Encounter state module

Introduce a small server-side encounter state machine that Tier-2 boss fights can attach to `run.encounter`, independent of any specific quest wiring.

## Acceptance Criteria

- `game/server/encounters.js` exists and exports helpers to create, read, and transition encounter state (`phase`: `dormant` | `active` | `cleared`; `bossEnemyId`; `locked`; `spawnAnchor` with `{ x, z }`).
- `createRunState()` in `progression.js` initializes `run.encounter` when the active quest declares encounter metadata (see sub-ticket 02); runs without encounter metadata leave `run.encounter` null/undefined.
- `stateSnapshot()` / run payloads include `encounter` so clients and tests can observe phase and lock without private server fields.
- Suspended-run checkpoints that deep-copy `run` preserve `encounter` fields round-trip (unit test clones a run with encounter state and asserts equality).
- Dedicated unit tests cover valid phase transitions (`dormant` → `active` → `cleared`) and reject invalid transitions (e.g. `cleared` → `active`).

## Technical Specs

- **New:** `game/server/encounters.js`
  - `createEncounterState({ spawnAnchor })` → initial `{ phase: 'dormant', bossEnemyId: null, locked: false, spawnAnchor }`.
  - `setEncounterBoss(run, enemyId)`, `activateEncounter(run)`, `lockEncounter(run)`, `clearEncounter(run)`.
  - `isEncounterLocked(run)`, `getEncounterBossId(run)`, `isEncounterCleared(run)`.
  - Guard all mutators when `run.encounter` is missing.
- **Edit:** `game/server/progression.js` — import helpers; in `createRunState()`, if `quest.encounter` (or equivalent field added in 02) is present, attach `encounter: createEncounterState(...)`.
- **Edit:** `game/server/test/encounters.test.js` (new) — pure state-machine tests; no socket harness required.
- Do not spawn enemies, hook combat, or change quest definitions in this sub-ticket.

## Verification: code
