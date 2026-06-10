# 05 — Tier-1 quest briefing and dialogue content

Author named clients, briefing copy, and 2–3 mid-run dialogue beats for **every** existing tier-1 quest in `QUEST_DEFS`. This sub-ticket is primarily content; it must satisfy the parent ticket's `crystal_rescue` acceptance path.

## Acceptance Criteria

- All eight tier-1 quests have non-empty `client.name` and `client.briefing`: `training_caverns`, `crystal_rescue`, `arena_trials`, `frost_crossing`, `canyon_descent`, `ember_descent`, `spire_ascent`, `endless_siege`.
- Each tier-1 quest has **2–3** `dialogue` entries with distinct `text` values and triggers appropriate to the objective type:
  - `defeat_enemies` / `survive` / `stage_boss`: include `run_start` + `objective_complete`; third beat may be a flavor line on `run_start` duplicate avoided — use a progress-appropriate trigger (e.g. `'objective_complete'` plus one `run_start` and one extra beat keyed to objective type).
  - `collect_items` (`crystal_rescue` tier 1): include `run_start`, `{ itemCollected: 1 }`, `{ itemCollected: 2 }`, `{ itemCollected: 3 }`, and `objective_complete` with **distinct** text per prism plus an extraction line on `objective_complete`.
- `crystal_rescue` tier-1 dialogue texts are unique per `itemCollected` index (server test asserts 1/2/3/complete emit different strings).
- Briefing tone matches PSO guild-counter style: short client intro, stated stakes, reward already known.
- `cd game && pnpm test:quick` passes; `game/server/test/quests.test.js` (or `questDialogue.test.js`) asserts content completeness via a helper that iterates tier-1 keys.

## Technical Specs

- **`game/server/quests.js`** — Populate `client` and `dialogue` on every `tiers[1]` entry listed above. No engine changes unless a missing trigger type is discovered (fix in sub-ticket 03 instead).
- **`game/server/test/quests.test.js`** or **`game/server/test/questDialogue.test.js`** — Snapshot or structural test: each tier-1 quest has `client.name`, `client.briefing`, `dialogue.length >= 2`, and `crystal_rescue` tier 1 has four `itemCollected` triggers plus `objective_complete`.
- Optional integration test: deploy `crystal_rescue` with debug scenario `collect-prisms-progress` and assert sequential `questDialogue` payloads (if harness socket test is lightweight).

## Verification: code
