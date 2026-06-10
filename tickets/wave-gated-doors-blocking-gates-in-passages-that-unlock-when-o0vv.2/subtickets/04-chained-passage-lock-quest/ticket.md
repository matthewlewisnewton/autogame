# 04 — Chained passage-lock quest content

Author a scripted quest layout that chains two wave-gated passages — room A wave clears gate to room B, room B wave clears gate to a treasure/end room — and prove the full sequence in an integration test.

## Acceptance Criteria

- A scripted quest definition declares **two** `passageLocks` entries bound to different `afterWave` targets (room 0 wave 0 → first passage; room 1 wave 0 → second passage).
- On deploy, both configured passages start `locked: true` until their respective waves clear; only the first lock opens after room A wave 0, and the second opens only after room B wave 0.
- After the first unlock, the player/enemy can enter room B but remains blocked at the second gate until room B's wave clears.
- `training_caverns` tier 1 **or** `SCRIPTED_ENCOUNTER_FIXTURE_DEF` tier 1 carries this chained config (prefer extending the fixture for deterministic layout seeds used in tests).
- `cd game && pnpm test:quick` passes, including a new `game/server/test/passage_lock_chain.test.js` that walks the full A → B → treasure progression.

## Technical Specs

- **Edit:** `game/server/quests.js` — extend `SCRIPTED_ENCOUNTER_FIXTURE_DEF.tiers[1].scriptedEncounters` with a third room (treasure/end) and two `passageLocks` resolved via `findPassageIndexFromRoom` / explicit `passageIndex` at test registration time (mirror `buildPassageLockFixtureDef` pattern in `game/server/test/passage_locks.test.js`).
- **Edit:** `game/server/debugScenarios.js` — ensure `passage-lock-gated` scenario still deploys a single-lock smoke path; add optional `passage-lock-chain` debug scenario name if helpful for manual QA.
- **Edit:** `game/server/scriptedEncounters.js` — no new unlock logic expected; reuse `initPassageLocks` + `unlockPassagesForWave`.
- **Add:** `game/server/test/passage_lock_chain.test.js` — generate layout, register chained fixture quest, deploy, assert both locks present; clear room 0 wave → first lock opens, second still locked; enter room 1, clear wave → second lock opens; verify colliders at each step via `checkWallCollision` / `getWallColliders`.

## Verification: code
