# 03 — Open-plaza Tier 2 end-to-end reference

Wire `arena_trials` Tier 2 as the reference Level-2 experience on open-plaza: unlock-gated Tier 2 quest row, rigid layout, high variant rate, and a fully deployable run using the mechanisms from sub-tickets 01–02.

## Acceptance Criteria

- `arena_trials` exposes a Tier 2 definition (`tier: 2`, display name/description, `unlockRequires: { questId: 'arena_trials', tier: 1 }`, `layoutProfile: 'open-plaza'`, `layoutMode: 'rigid'`) and appears in `listQuestVariants()`.
- Selecting and deploying `arena_trials` Tier 2 (with account unlock) generates an open-plaza layout via `applyLayoutForQuest` with `layoutMode: 'rigid'` and a tier-specific seed distinct from Tier 1.
- A Tier 2 deploy spawns the quest's enemies on walkable floor clear of cover; at least one spawned enemy carries a non-null `variant` under a fixed seed test (proving quest-tier variant scaling on open-plaza).
- Tier 1 `arena_trials` behavior is unchanged: default layout mode, near-zero variant tags on the same open-plaza geometry.
- Victory on `arena_trials` Tier 1 unlocks Tier 2 for participating accounts (existing 253 plumbing; add/extend test if not already covered for this quest id).
- Integration/unit tests cover catalog resolution, layout options, and spawn outcomes for both tiers; `pnpm test:quick` passes.

## Technical Specs

- **`game/server/quests.js`** — Add `arena_trials.tiers[2]` with Tier-2 metadata and `layoutMode: 'rigid'`; ensure `getQuest`, `isValidQuestSelection`, and `listQuestVariants` include the new row.
- **`game/server/index.js`** / **`game/server/socketHandlers/lobbyHandlers.js`** — No new handlers expected; confirm `applyLayoutForQuest` and deploy paths already consume tier from `selectedQuestTier` / `run.questTier`.
- **`game/server/test/quests.test.js`** — Extend variant catalog expectations (`arena_trials` Tier 2 present, `layoutMode`/`layoutProfile` resolved).
- **`game/server/test/dungeon.test.js`** or **`game/server/test/arena_spawn_cover.test.js`** — Tier 2 rigid layout + spawn assertions; compare Tier 1 vs Tier 2 layout `cover` stability.
- **`game/server/test/variant_rate_by_quest_tier.test.js`** or **`game/server/test/arena_trials_tier2.test.js`** (new) — End-to-end spawn with `gameState.run.questTier = 2`, `selectedQuestId = 'arena_trials'`, seeded layout, variant tag rate check.
- **`game/client/test/questBoard.test.js`** (optional) — If variant count assertions are hard-coded, update for the additional Tier 2 row.
- Reuse sub-ticket 01 variant resolver and sub-ticket 02 `getLayoutGenerationOptions`; do not reimplement those mechanisms here.

## Verification: code
