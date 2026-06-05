# 01 — Quest tier data model

Introduce a tier-aware quest catalog in `quests.js` so every level exposes Tier 1 (always available) and an optional Tier 2 definition gated later by account unlocks. Tier 2 entries are framework stubs only (no bespoke difficulty content); use `training_caverns` as the single reference quest that declares a Tier 2 variant.

## Acceptance Criteria

- `QUEST_DEFS` entries support Tier 1 (implicit or explicit) and optional Tier 2 metadata (`tier: 2`, display fields, and `unlockRequires: { questId, tier: 1 }`).
- Exported helpers resolve a quest by `(questId, tier)` with Tier 1 as the default when tier is omitted; invalid pairs return `null`.
- `listQuestVariants()` (or equivalent) returns board-ready entries for every quest/tier pair in the catalog, including `tier`, `questId`, `name`, objective/reward summaries, and whether the row is Tier 2.
- `isValidQuestSelection(questId, tier)` validates catalog membership (Tier 1 for all quests; Tier 2 only where defined).
- `getLayoutProfileForQuest(questId, tier)` and layout-seed input accept tier so Tier 2 can diverge later without another API change.
- `game/server/test/quests.test.js` (new) covers resolution, defaults, and the `training_caverns` Tier 2 stub; `pnpm test:quick` passes.

## Technical Specs

- **`game/server/quests.js`** — Refactor `QUEST_DEFS` to a tier-capable shape (e.g. base quest id + `tiers: { 1: {...}, 2: {...} }` or `tier2: {...}` block). Update `getQuest`, `listQuests`, `getSelectedQuest`, `getLayoutProfileForQuest`, `buildQuestUpdatePayload` signatures to accept optional `tier` without breaking existing single-argument call sites (default tier `1`).
- **`game/server/dungeon.js`** — Extend `questLayoutSeed(questId, tier)` (tier defaults to `1`; incorporate tier into the hash string so Tier 2 seeds differ from Tier 1).
- **`game/server/test/quests.test.js`** — New file; no socket tests in this sub-ticket.
- Do **not** add account persistence, victory unlock, `selectQuest` gating, or client UI here.

## Verification: code
