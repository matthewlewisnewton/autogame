# 01 — Quest briefing data model and server payload

Add `client` and `dialogue` fields to quest tier definitions in `quests.js` and expose them through the existing quest listing/selection APIs so the client can render briefing copy before deploy. Seed `training_caverns` tier 1 with a minimal sample so later sub-tickets have real data to consume.

## Acceptance Criteria

- Each quest tier in `QUEST_DEFS` may declare `client: { name: string, briefing: string }` and `dialogue: [{ trigger, text }]`.
- `trigger` supports `'run_start'`, `'objective_complete'`, `{ itemCollected: number }`, and `{ waveCleared: number }` (wave trigger may remain unused until a future wave bead).
- `getQuest()`, `listQuests()`, and `listQuestVariants()` include `client` and `dialogue` on resolved tier objects (omit or empty-array when absent).
- `buildSharedQuestUpdatePayload()` / `buildQuestUpdatePayload()` quest rows carry `client` through to the client unchanged.
- `training_caverns` tier 1 has a non-empty `client.name`, `client.briefing`, and at least one `dialogue` entry for smoke testing.
- `cd game && pnpm test:quick` passes; new/updated assertions live in `game/server/test/quests.test.js`.

## Technical Specs

- **`game/server/quests.js`** — Extend tier typedef comments; add `client` / `dialogue` on tier defs (stub only on `training_caverns` tier 1 in this sub-ticket). Spread fields through `getQuest()` and variant rows in `listQuestVariants()`.
- **`game/server/test/quests.test.js`** — Assert payload shape for `getQuest('training_caverns', 1)` and that `listQuests()[0]` (or the training row) includes `client.name`.
- Do **not** add socket events, dialogue firing, or client UI here.

## Verification: code
