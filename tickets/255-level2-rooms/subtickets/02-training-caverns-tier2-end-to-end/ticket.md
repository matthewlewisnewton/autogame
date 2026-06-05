# 02 — Training Caverns Tier 2 end-to-end

Wire `training_caverns` Tier 2 as a fully deployable Level-2 quest on the `crowded` profile: unlock-gated catalog row, rigid layout via sub-ticket 01, high variant rate from ticket 254's quest-tier scaling, and crowded room identity unchanged.

## Acceptance Criteria

- `training_caverns` Tier 2 definition includes `layoutMode: 'rigid'` (in addition to existing `layoutProfile: 'crowded'` and unlock metadata) and still appears in `listQuestVariants()`.
- `getLayoutGenerationOptions('training_caverns', 2)` returns `{ slopes: true, layoutMode: 'rigid' }`; Tier 1 remains `{ slopes: true, layoutMode: 'default' }`.
- Deploying Tier 2 (with account unlock) calls `applyLayoutForQuest` with the tier-specific `questLayoutSeed('training_caverns', 2)` and produces a rigid crowded layout whose `rooms`, `cover`, and `landmarks` are stable across seeds.
- Tier 2 deploy spawns the quest's `enemyCount` on walkable floor in combat rooms clear of cover; at least one spawned enemy has a non-null `variant` under a fixed seed test.
- Tier 1 `training_caverns` behavior is unchanged: default layout mode, near-zero variant tags on the same seed batch, and existing crowded cover-per-combat-room rules still pass.
- Victory on `training_caverns` Tier 1 unlocks Tier 2 for participating accounts (253 plumbing; extend test if not already covered for deploy + variant outcomes on this quest id).
- Debug shortcut `training-caverns-tier-2` (behind `ALLOW_DEBUG_SCENARIOS=1`) sets `selectedQuestId` / `selectedQuestTier` and applies the Tier-2 layout **before** `enterPlayingPhase()` so `run.questTier` and variant rolls match normal deployment (follow the `arena-trials-tier-2` pattern from ticket 254).
- Integration/unit tests cover catalog resolution, layout options, rigid crowded geometry, spawn outcomes, variant rate, unlock, and the debug scenario; `pnpm test:quick` passes.

## Technical Specs

- **`game/server/quests.js`**
  - Add `layoutMode: 'rigid'` to `training_caverns.tiers[2]`.
  - Confirm `getQuest`, `isValidQuestSelection`, `listQuestVariants`, `getLayoutProfileForQuest`, and `getLayoutGenerationOptions` resolve the updated row.
- **`game/server/debugScenarios.js`**
  - Add `training-caverns-tier-2` scenario: unlock Tier 2, set `selectedQuestId = 'training_caverns'` and `selectedQuestTier = 2`, call `applyLayoutForQuest(state, 'training_caverns', 2)`, position player in the start room, then `enterPlayingPhase` / `spawnEnemies` in the correct order.
  - Register the scenario name in the debug allowlist (e.g. `game/server/index.js`).
- **`game/server/test/training_caverns_tier2.test.js`** (new, modeled on `arena_trials_tier2.test.js`)
  - Catalog + `getLayoutGenerationOptions` assertions.
  - Rigid crowded layout stable across seeds for Tier 2; Tier 1 default layout still varies dressing across seeds.
  - Deploy spawn: enemy count, walkable positions, Tier-2 variant tagging, Tier-1 null variants.
  - Socket test: Tier 1 victory unlocks Tier 2 for `training_caverns` (if not already asserted elsewhere for this quest).
- **`game/server/test/quests.test.js`** — Extend `getLayoutGenerationOptions` expectations for `training_caverns` Tier 2 (`layoutMode: 'rigid'`).
- **`game/server/test/debug-scenarios.test.js`** — Assert `training-caverns-tier-2` sets `run.questTier === 2` and uses rigid layout options when `ALLOW_DEBUG_SCENARIOS=1`.
- **`game/client/test/questBoard.test.js`** (only if hard-coded variant counts or tier rows break).
- Reuse sub-ticket 01 rigid grid generator and ticket 254's `resolveVariantRollTier` / `getLayoutGenerationOptions`; do not reimplement those mechanisms.

## Verification: code
