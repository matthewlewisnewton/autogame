# 03 — Server quest dialogue trigger pipeline

Evaluate quest `dialogue` triggers on the server and broadcast a `questDialogue` socket event to every connected squad member when a beat fires. Triggers are authoritative (not client timers) and fire once per run per matching entry.

## Acceptance Criteria

- New `QUEST_DIALOGUE` entry in `game/shared/events.json` (`serverToClient.questDialogue` → `'questDialogue'`).
- On run deploy / `startGame`, any `dialogue` entry with `trigger: 'run_start'` for the active quest tier emits once to the lobby room.
- On prism collection (`recordCrystalCollected`), emits the entry whose `trigger` is `{ itemCollected: n }` matching the new `run.objective.collectedItems` count.
- When the run objective transitions to complete (`isRunObjectiveComplete` becomes true), emits the entry with `trigger: 'objective_complete'` once.
- `{ waveCleared: n }` triggers are recognized by the matcher but may no-op until the wave system lands; add a unit test proving match logic only.
- Payload shape: `{ speaker: string, text: string, questId, tier, trigger }` where `speaker` defaults to `client.name`.
- Duplicate triggers in the same run do not re-emit (track fired keys on `run` or a small helper).
- `cd game && pnpm test:quick` passes; integration coverage in `game/server/test/quests.test.js` or a new `game/server/test/questDialogue.test.js` using `training_caverns` / `crystal_rescue` stub dialogue from sub-ticket 01/05.

## Technical Specs

- **`game/shared/events.json`** — Add `QUEST_DIALOGUE: "questDialogue"` under `serverToClient`.
- **`game/server/questDialogue.js`** (new) — Export `matchDialogueTrigger(entry, event)`, `fireQuestDialogue(io, gameState, event)`, `resetDialogueState(run)`; read dialogue list from `getQuest(questId, tier)`.
- **`game/server/progression.js`** — Call `fireQuestDialogue` after run creation/deploy (`run_start`), inside `recordCrystalCollected` after increment, and at the objective-complete transition point (same code path that sets run status toward victory).
- **`game/server/index.js`** — Import and ensure dialogue helper can access `io` + `gameState` (pass through existing broadcast helpers).
- **`game/server/test/questDialogue.test.js`** (new, preferred) — Unit tests for trigger matching and one-shot dedupe.

## Verification: code
