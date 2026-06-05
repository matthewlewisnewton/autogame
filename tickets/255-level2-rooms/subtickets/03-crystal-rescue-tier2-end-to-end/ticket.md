# 03 — Crystal Rescue Tier 2 end-to-end

Add and wire `crystal_rescue` Tier 2 as the open-profile Level-2 reference: unlock-gated catalog row, rigid `open` layout via sub-ticket 01, high variant rate from ticket 254, and open room identity (platforms, pits, sand-spire landmarks) unchanged.

## Acceptance Criteria

- `crystal_rescue` exposes a Tier 2 definition (`tier: 2`, prism-themed display name/description, `unlockRequires: { questId: 'crystal_rescue', tier: 1 }`, `layoutProfile: 'open'`, `layoutMode: 'rigid'`, scaled `itemCount` / `enemyCount` / `rewardCurrency` appropriate for Tier 2) and appears in `listQuestVariants()`.
- `getLayoutGenerationOptions('crystal_rescue', 2)` returns `{ slopes: true, layoutMode: 'rigid' }`; Tier 1 remains `{ slopes: true, layoutMode: 'default' }`.
- Deploying Tier 2 (with account unlock) generates a rigid open layout via `applyLayoutForQuest` with `questLayoutSeed('crystal_rescue', 2)`; `rooms`, `platforms`, `hazards`, `cover`, and `landmarks` are stable across seeds.
- Tier 2 deploy spawns enemies and collectible prisms on walkable floor clear of cover/platforms/hazards; at least one spawned enemy carries a non-null `variant` under a fixed seed test.
- Tier 1 `crystal_rescue` behavior is unchanged: default layout mode, near-zero variant tags, and existing `collect_items` objective flow still passes.
- Victory on `crystal_rescue` Tier 1 unlocks Tier 2 for participating accounts (253 plumbing; add socket test if not already covered for this quest id).
- Debug shortcut `crystal-rescue-tier-2` (behind `ALLOW_DEBUG_SCENARIOS=1`) sets quest/tier and applies the Tier-2 layout before `enterPlayingPhase()` so `run.questTier` and variant rolls match normal deployment.
- Integration/unit tests cover catalog resolution, layout options, rigid open geometry, spawn/collect outcomes, variant rate, unlock, and the debug scenario; `pnpm test:quick` passes.

## Technical Specs

- **`game/server/quests.js`**
  - Add `crystal_rescue.tiers[2]` with Tier-2 metadata, `layoutProfile: 'open'`, `layoutMode: 'rigid'`, and `unlockRequires`.
  - Confirm `getQuest`, `isValidQuestSelection`, `listQuestVariants`, `getLayoutProfileForQuest`, and `getLayoutGenerationOptions` include the new row.
- **`game/server/debugScenarios.js`**
  - Add `crystal-rescue-tier-2` scenario: unlock Tier 2, set `selectedQuestId = 'crystal_rescue'` and `selectedQuestTier = 2`, call `applyLayoutForQuest`, position player in the start room, then `enterPlayingPhase` with correct `collect_items` run snapshot.
  - Register the scenario name in the debug allowlist.
- **`game/server/test/crystal_rescue_tier2.test.js`** (new, modeled on `arena_trials_tier2.test.js` / `training_caverns_tier2.test.js`)
  - Catalog + `getLayoutGenerationOptions` assertions.
  - Rigid open layout stable across seeds for Tier 2; Tier 1 default layout still varies dressing across seeds.
  - Deploy spawn: enemy count, prism placement, walkable positions, Tier-2 variant tagging, Tier-1 null variants.
  - Socket test: Tier 1 victory unlocks Tier 2 for `crystal_rescue`.
- **`game/server/test/quests.test.js`** — Extend variant catalog expectations (`crystal_rescue` Tier 2 present, `layoutMode` / `layoutProfile` / unlock metadata; update `isTier2` count).
- **`game/server/test/debug-scenarios.test.js`** — Assert `crystal-rescue-tier-2` sets `run.questTier === 2`, `objectiveType === 'collect_items'`, and uses rigid layout options when `ALLOW_DEBUG_SCENARIOS=1`.
- **`game/client/test/questBoard.test.js`** (only if hard-coded variant counts break).
- Reuse sub-ticket 01 rigid open generator and ticket 254 quest-tier variant scaling; do not reimplement those mechanisms.

## Verification: code
