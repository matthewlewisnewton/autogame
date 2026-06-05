# 02 — Canyon Descent Tier 2 end-to-end

Wire `canyon_descent` Tier 2 as a fully deployable Level-2 quest on the `sunken-canyon` profile: unlock-gated catalog row, rigid layout via sub-ticket 01, high variant rate from ticket 254's quest-tier scaling, and canyon-specific spawn/identity behavior unchanged.

## Acceptance Criteria

- `canyon_descent` exposes a Tier 2 definition (`tier: 2`, canyon-themed display name/description, `unlockRequires: { questId: 'canyon_descent', tier: 1 }`, `layoutProfile: 'sunken-canyon'`, `layoutMode: 'rigid'`) and appears in `listQuestVariants()`.
- `getLayoutGenerationOptions('canyon_descent', 2)` returns `{ slopes: true, layoutMode: 'rigid' }`; Tier 1 remains `{ slopes: true, layoutMode: 'default' }`.
- Deploying Tier 2 (with account unlock) calls `applyLayoutForQuest` with the tier-specific `questLayoutSeed('canyon_descent', 2)` and produces a rigid sunken-canyon layout structurally stable across seeds.
- Tier 2 deploy spawns the quest's `enemyCount` on walkable floor (at least one on plateau, majority on canyon band, none on ramp connectors); at least one spawned enemy has a non-null `variant` under a fixed seed test.
- Tier 1 `canyon_descent` behavior is unchanged: default layout mode, near-zero variant tags on the same seed batch, and existing canyon spawn band logic still passes.
- Victory on `canyon_descent` Tier 1 unlocks Tier 2 for participating accounts (253 plumbing; add/extend test if not already covered for this quest id).
- Optional debug shortcut `sunken-canyon-tier-2` (behind `ALLOW_DEBUG_SCENARIOS=1`) sets `selectedQuestId` / `selectedQuestTier` and applies the Tier-2 layout **before** `enterPlayingPhase()` so `run.questTier` and variant rolls match normal deployment (follow the fixed `arena-trials-tier-2` / `spire-ascent-tier-2` pattern from tickets 254/257).
- Integration/unit tests cover catalog resolution, layout options, rigid canyon geometry, spawn outcomes, variant rate, and unlock; `pnpm test:quick` passes.

## Technical Specs

- **`game/server/quests.js`**
  - Add `canyon_descent.tiers[2]` with Tier-2 metadata, `layoutMode: 'rigid'`, and `unlockRequires`.
  - Confirm `getQuest`, `isValidQuestSelection`, `listQuestVariants`, `getLayoutProfileForQuest`, and `getLayoutGenerationOptions` resolve the new row.
- **`game/server/debugScenarios.js`**
  - Add `sunken-canyon-tier-2` scenario: unlock Tier 2 if needed, set `selectedQuestId = 'canyon_descent'` and `selectedQuestTier = 2`, call `applyLayoutForQuest(state, 'canyon_descent', 2)`, position player on plateau spawn, then `enterPlayingPhase` / `spawnEnemies` in the correct order (early branch before generic `enterPlayingPhase` if required).
  - Register the scenario name wherever debug scenario allowlists live (e.g. `game/server/index.js`).
- **`game/server/test/canyon_descent_tier2.test.js`** (new, modeled on `arena_trials_tier2.test.js` / `spire_ascent_tier2.test.js`)
  - Catalog + `getLayoutGenerationOptions` assertions.
  - Rigid canyon layout stable across seeds for Tier 2; Tier 1 default layout still varies ramp count across seeds.
  - Deploy spawn: enemy count, walkable positions, plateau/canyon band distribution, Tier-2 variant tagging, Tier-1 null variants.
  - Socket test: Tier 1 victory unlocks Tier 2 for `canyon_descent`.
- **`game/server/test/quests.test.js`** — Extend variant catalog expectations for `canyon_descent` Tier 2 (`layoutMode`, `layoutProfile`, unlock metadata).
- **`game/server/test/sunken_canyon_spawn.test.js`** — Extend or add Tier-2 deploy cases if existing band/spawn assertions need a rigid-layout fixture.
- **`game/server/test/debug-scenarios.test.js`** — Assert `sunken-canyon-tier-2` sets `run.questTier === 2` and uses rigid layout options when `ALLOW_DEBUG_SCENARIOS=1`.
- **`game/client/test/questBoard.test.js`** (only if hard-coded variant counts break).
- Reuse sub-ticket 01 rigid canyon generator and ticket 254's `resolveVariantRollTier` / `getLayoutGenerationOptions`; do not reimplement those mechanisms.

## Verification: code
