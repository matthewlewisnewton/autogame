# 07 — Tier-2 quest briefing and dialogue content

Unlocked tier-2 contracts appear on the quest board via `listQuestVariants()`, but their tier defs lack `client` and `dialogue`, so selecting any tier-2 row shows the `Contract issuer unknown` fallback. Author named clients, briefing copy, and 2–3 dialogue beats for every selectable tier-2 quest so the board meets the parent ticket's pre-ready briefing requirement for all contracts.

## Acceptance Criteria

- All five tier-2 quest tiers have non-empty `client.name` and `client.briefing`: `training_caverns` tier 2, `crystal_rescue` tier 2, `arena_trials` tier 2, `canyon_descent` tier 2, `spire_ascent` tier 2.
- Each tier-2 quest has **2–3** `dialogue` entries with distinct `text` and triggers appropriate to its `objectiveType`:
  - `stage_boss` tiers: `run_start`, `objective_complete`, plus one progress-appropriate beat (e.g. flavor on `run_start` avoided — use a mid-run trigger if applicable).
  - `collect_items` (`crystal_rescue` tier 2): `run_start`, per-`itemCollected` beats for the tier's `itemCount` (5), and `objective_complete`.
- `listQuestVariants()` / quest-board payloads include `client` for every tier-2 row; selecting a tier-2 contract in `renderQuestBoard` shows the real client name and briefing (not `Contract issuer unknown`).
- Briefing tone matches tier-1 PSO guild-counter style: named client, stated stakes, reward known upfront.
- `cd game && pnpm test:quick` passes; structural tests iterate all tier-2 keys and assert `client` + `dialogue` completeness; `questBoard.test.js` renders at least one tier-2 row with real client copy.

## Technical Specs

- **`game/server/quests.js`** — Add `client` and `dialogue` to each `tiers[2]` entry listed above. Reuse or extend tier-1 client personas where narratively appropriate (e.g. Rewa for Vault Tier II, Lysa for Prism Salvage Tier II) with tier-appropriate briefing text and higher-stakes dialogue.
- **`game/server/test/quests.test.js`** — Add helper/assertions that every tier-2 quest in `QUEST_DEFS` has `client.name`, `client.briefing`, and `dialogue.length >= 2`; `crystal_rescue` tier 2 has `itemCollected` triggers through `itemCount`.
- **`game/client/test/questBoard.test.js`** — Render a tier-2 sample row (from `listQuestVariants` shape or fixture) and assert briefing panel shows authored client name, not `Contract issuer unknown`.
- No changes to `formatClientBriefing` fallback logic unless a shared inherit-from-tier-1 helper is cleaner than duplicating copy (prefer explicit per-tier content).

## Verification: code
