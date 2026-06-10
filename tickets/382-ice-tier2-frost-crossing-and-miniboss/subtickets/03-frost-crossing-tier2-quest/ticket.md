# 03 — Frost Crossing Tier II quest entry (unlock, rigid layout, dense pool, Glacial Tyrant stage boss)

Add the frost_crossing Tier II quest definition following the established tier-2 pattern (training_caverns/arena_trials/canyon_descent/spire_ascent): unlocked by beating frost_crossing tier 1, rigid ice-cavern layout, a denser tier-2 enemy pool, and a `stage_boss` encounter against the Glacial Tyrant at the ice cairn. Depends on sub-tickets 01 (`glacial_tyrant` enemy type) and 02 (ice-cavern rigid mode).

## Acceptance Criteria

- `isValidQuestSelection('frost_crossing', 2)` is true; `getQuest('frost_crossing', 2)` returns a def with `tier: 2`, `name: 'Frost Crossing — Tier II'`, `objectiveType: 'stage_boss'`, `layoutProfile: 'ice-cavern'`, `layoutMode: 'rigid'`, and `unlockRequires: { questId: 'frost_crossing', tier: 1 }`.
- The tier-2 encounter is `{ bossType: 'glacial_tyrant', landmark: 'ice_cairn', addCount: 4 }` (via `getEncounterConfig`).
- `getLayoutGenerationOptions('frost_crossing', 2)` returns `{ slopes: true, layoutMode: 'rigid' }`; tier 1 stays `{ slopes: true, layoutMode: 'default' }`.
- frost_crossing gains a `tier2EnemyPool` of `[{ type: 'glacial_thrower', weight: 2 }, { type: 'field_medic', weight: 1 }]`; `getEnemyPool('frost_crossing', 2)` returns the base pool merged with it (denser throwers + support variant) while `getEnemyPool('frost_crossing', 1)` is unchanged. `getGuaranteedEnemyType('frost_crossing')` still returns `glacial_thrower`.
- `listQuestVariants()` includes a frost_crossing entry with `tier: 2`, `isTier2: true`, the `unlockRequires` payload, the Tier II client briefing, and dialogue.
- `formatObjectiveSummary` for frost_crossing tier 2 reads "Defeat the Glacial Tyrant and 4 supports" via new theme strings; tier 1 still produces the Permafrost Warden summary (branch on `encounter.bossType`, not on tier).
- Deploying frost_crossing tier 2 (per the tier2-test deploy pattern) spawns exactly one `glacial_tyrant` anchored at the `ice_cairn` landmark on the treasure pad plus 4 adds drawn from the tier-2 pool; killing all adds and the boss completes the objective and yields victory (`run.status === 'victory'`).
- Tier-1 frost_crossing victory unlocks tier 2 for the account (existing generic `unlockQuestTier(accountId, questId, 2)` path — assert via `users.js` in the test).
- New test `game/server/test/frost_crossing_tier2.test.js` covers the bullets above (model it on `canyon_descent_tier2.test.js` / `spire_ascent_tier2.test.js`).
- Full vitest server + client suites pass (`cd game && pnpm test:quick`); pre-existing tests that enumerate quests/tiers (`tier1_quest_identity`, `quests-spawn-pools`, `questBoard`, `findings_render`) are updated only if they legitimately enumerate the new tier.

## Technical Specs

- `game/server/quests.js`:
  - On the `frost_crossing` quest object, add `tier2EnemyPool: [{ type: 'glacial_thrower', weight: 2 }, { type: 'field_medic', weight: 1 }]` (merge logic in `getEnemyPool` is already generic).
  - Add `tiers[2]` modeled on the spire_ascent/canyon_descent tier-2 entries:
    ```js
    2: {
      tier: 2,
      name: 'Frost Crossing — Tier II',
      description: 'Cross the fixed ice sheet where the Glacial Tyrant holds the south cairn with marked support.',
      objectiveType: 'stage_boss',
      rewardCurrency: 14,
      layoutProfile: 'ice-cavern',
      layoutMode: 'rigid',
      unlockRequires: { questId: 'frost_crossing', tier: 1 },
      signatureCardId: 'ice_ball',
      rewardCards: ['ice_ball', 'frost_nova', 'permafrost_lance'],
      encounter: { bossType: 'glacial_tyrant', landmark: 'ice_cairn', addCount: 4 },
      client: {
        name: 'Cairn',
        briefing: 'Frost crossing contract — Tier II. The Glacial Tyrant has claimed the south cairn with four marked hostiles on the sheet; break them all and fourteen stones release from the research fund.',
      },
      dialogue: [
        { trigger: 'run_start', text: 'Cairn on ice-watch channel. Tyrant signature at the south cairn — thin the marked hostiles before you cross the sheet.' },
        { trigger: { waveCleared: 2 }, text: 'Half the marked hostiles are down. The Glacial Tyrant is still winding up at the cairn — keep moving.' },
        { trigger: 'objective_complete', text: 'Tyrant shattered and the crossing is ours. Research fund transfer pending — Tier II logged.' },
      ],
    },
    ```
  - In `formatObjectiveSummary`, inside the existing `questId === 'frost_crossing'` stage-boss branch, pick strings by boss type: `getEncounterConfig(quest)?.bossType === 'glacial_tyrant'` → `THEME.objectives.defeatGlacialTyrant` / `defeatGlacialTyrantWithSupports` (with `{addCount}` replacement); otherwise keep the Permafrost Warden strings.
- `game/shared/theme.json` — add to `objectives`: `"defeatGlacialTyrant": "Defeat the Glacial Tyrant"`, `"defeatGlacialTyrantWithSupports": "Defeat the Glacial Tyrant and {addCount} supports"`.
- No client code changes expected: the quest board renders tier-2 variants generically from `listQuestVariants` + `unlockedQuestTiers`, and boss visuals landed in sub-ticket 01.
- `game/server/test/frost_crossing_tier2.test.js` — new file; reuse the deploy helper pattern from `spire_ascent_tier2.test.js` (`deploy…StageBoss` setting `selectedQuestId/Tier`, layout via `getLayoutProfileForQuest` + `getLayoutGenerationOptions`, then `spawnEnemies()` + `startDungeonRun()`), and the boss-kill → `checkRunTerminalState()` victory flow plus the tier-unlock assertion from those tests.

## Verification: code
