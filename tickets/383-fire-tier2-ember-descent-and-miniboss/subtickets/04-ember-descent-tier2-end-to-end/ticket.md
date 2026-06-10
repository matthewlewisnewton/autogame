# 04 — Ember Descent Tier II end-to-end

Wire `ember_descent` Tier II as a fully deployable Level-2 quest on the `fire-cavern` profile with the Magma Colossus stage boss (sub-tickets 02–03), rigid layout (sub-ticket 01), variant enemy pool, unlock gating, and harness coverage. Replace the placeholder `cinder_warden` Tier-II wiring from ticket 381 with the correct `magma_colossus` encounter.

## Acceptance Criteria

- `ember_descent` exposes a Tier 2 definition (`tier: 2`, fire-themed display name/description, `unlockRequires: { questId: 'ember_descent', tier: 1 }`, `layoutProfile: 'fire-cavern'`, `layoutMode: 'rigid'`, `objectiveType: 'stage_boss'`) and appears in `listQuestVariants()`.
- `getLayoutGenerationOptions('ember_descent', 2)` returns `{ slopes: true, layoutMode: 'rigid' }`; Tier 1 remains `{ slopes: true, layoutMode: 'default' }`.
- `ember_descent` defines `tier2EnemyPool: [{ type: 'field_medic', weight: 1 }]`; Tier 2 deploy merges it into spawn draws and at least one support add can roll `field_medic` under a fixed seed test.
- Tier 2 `encounter.bossType` is `magma_colossus` (not `cinder_warden`); deploying Tier 2 spawns exactly one `magma_colossus` boss plus `addCount` support adds with no bulk pack. Defeating the active boss clears the encounter and completes the `stage_boss` objective.
- `game/shared/theme.json` adds `objectives.defeatMagmaColossus` and `objectives.defeatMagmaColossusWithSupports`; the `ember_descent` objective-label branch in `game/server/quests.js` returns these strings (remove or stop using `defeatCinderWarden*` for Tier II).
- Tier II briefing, dialogue, and objective summary reference the Magma Colossus (not the Cinder Warden).
- Deploying Tier 2 (with account unlock) uses `questLayoutSeed('ember_descent', 2)` and produces a rigid fire-cavern layout structurally stable across seeds; at least one spawned support has a non-null `variant` under a fixed seed test.
- Tier 1 `ember_descent` behavior is unchanged: scripted `defeat_enemies` arc, default layout mode, and existing tier-1 tests still pass.
- Victory on `ember_descent` Tier 1 unlocks Tier 2 for participating accounts (253 plumbing; add/extend test if not already covered).
- Debug shortcut `ember-descent-tier-2` (behind `ALLOW_DEBUG_SCENARIOS=1`) sets `selectedQuestId` / `selectedQuestTier`, applies the Tier-2 layout **before** `enterPlayingPhase()`, and spawns the dormant `magma_colossus` encounter (update comments from `cinder_warden`).
- Integration/unit tests cover catalog resolution, layout options, rigid fire-cavern geometry, spawn outcomes, variant rate, encounter activation/defeat, unlock, and debug scenario; `pnpm test:quick` passes.

## Technical Specs

- **`game/server/quests.js`**
  - Update `ember_descent.tiers[2]`: set `encounter.bossType` to `magma_colossus`; add `tier2EnemyPool`; refresh `client.briefing`, `description`, and `dialogue` for the Magma Colossus contract.
  - Change the `ember_descent` `stage_boss` objective-label branch to use `defeatMagmaColossus*` theme keys.
- **`game/shared/theme.json`**: add `defeatMagmaColossus` and `defeatMagmaColossusWithSupports` next to the other warden objective strings.
- **`game/server/debugScenarios.js`**
  - Update `ember-descent-tier-2` scenario comments and any boss-type guards to expect `magma_colossus`.
- **`game/server/test/ember_descent_tier2.test.js`** (new, modeled on `game/server/test/spire_ascent_tier2.test.js` / `canyon_descent_tier2.test.js`)
  - Catalog + `getLayoutGenerationOptions` assertions.
  - Rigid fire-cavern layout stable across seeds for Tier 2; Tier 1 default layout still varies ramp count across seeds.
  - Deploy spawn: boss + add counts, Tier-2 variant tagging on supports, Tier-1 null variants on scripted arc.
  - Encounter activation and boss-defeat objective completion.
  - Socket test: Tier 1 victory unlocks Tier 2 for `ember_descent`.
- **`game/server/test/ember_descent_stage_boss.test.js`**
  - Retarget all `cinder_warden` expectations to `magma_colossus` and updated objective strings.
- **`game/server/test/quests.test.js`** — Add `getLayoutGenerationOptions('ember_descent', 2)` rigid assertion; extend variant catalog expectations for Tier 2.
- **`game/server/test/quests-spawn-pools.test.js`** — Assert `getEnemyPool('ember_descent', 2)` merges `tier2EnemyPool` with `field_medic`.
- **`game/server/test/debug-scenarios.test.js`** — Assert `ember-descent-tier-2` sets `run.questTier === 2`, uses rigid layout options, and spawns `magma_colossus` when `ALLOW_DEBUG_SCENARIOS=1`.
- **`game/client/test/questBoard.test.js`** (only if hard-coded variant counts break).
- Reuse sub-ticket 01 rigid fire-cavern generator and ticket 254's variant-roll plumbing; do not reimplement those mechanisms.

## Verification: code
