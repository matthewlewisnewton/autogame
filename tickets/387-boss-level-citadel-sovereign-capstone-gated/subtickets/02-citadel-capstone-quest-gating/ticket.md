# Citadel capstone quest gated behind three Tier-II clears

Register the `citadel_assault` boss-level quest — the capstone arena where the
Citadel Sovereign waits — unlocked only after clearing canyon_descent Tier 2
AND spire_ascent Tier 2 AND arena_trials Tier 2. It dethrones rift_convergence
as the apex boss level, so the rift supremacy tests must be reconciled in the
same pass. Depends on sub-ticket 01 (`citadel_sovereign` enemy def).

## Acceptance Criteria

- `QUEST_DEFS.citadel_assault` exists in `game/server/quests.js` with a single
  tier `1`:
  - `name: 'The Citadel'`, `objectiveType: 'stage_boss'`,
    `levelKind: 'boss_level'`, `layoutProfile: 'boss-arena'`.
  - `unlockRequires: [{ questId: 'canyon_descent', tier: 2 },
    { questId: 'spire_ascent', tier: 2 }, { questId: 'arena_trials', tier: 2 }]`.
  - `encounter: { bossType: 'citadel_sovereign', landmark: 'arena_dais',
    addCount: 5 }` — strictly more adds than rift_convergence's 4 and every
    other boss level.
  - `rewardCurrency: 26` — strictly the highest boss-level purse
    (rift_convergence pays 22).
  - A quest-level `enemyPool` drawing only from the three prerequisite stages'
    foes (e.g. `void_seraph` weight 2, `spawner` weight 2, `miniboss` weight 1)
    so the arena reads as the three quest lines converging.
  - `client` briefing NPC + `dialogue` entries for `run_start`, a
    `{ waveCleared: N }` trigger, and `objective_complete`, in the same voice
    as the other contracts.
  - Reward card ids (`signatureCardId` / `rewardCards`) that already exist in
    `game/shared/cardDefs.json` — do NOT invent new cards.
- `getQuest('citadel_assault', 1)` resolves; the quest-list/level-map payload
  (the builder around `game/server/quests.js:1757`/`1811`) includes the
  citadel node with all three normalized `unlockRequires` prerequisites.
- Tier gating: with an account that has cleared only two of the three Tier-II
  prerequisites the quest is locked; with all three cleared it is unlocked
  (exercise the same per-account tier-clear path `rift_convergence` uses).
- `isBossLevelQuest('citadel_assault')` is true and the existing
  "every registered boss-level quest tier has required companion fields" check
  in `game/server/test/boss_level_schema.test.js` passes unmodified.
- `game/server/test/rift_convergence_e2e.test.js` is reconciled: the
  "fields strictly more encounter adds than every other boss level" and
  "pays the highest rewardCurrency of any boss level" tests now exclude the
  citadel capstone (with a comment naming it as the new apex) — or are
  inverted to assert the citadel tops both; either way the suite passes.
- New `game/server/test/citadel_capstone_quest.test.js` covering: quest
  registration + tier-def fields above; normalized 3-entry `unlockRequires`;
  locked with 2/3 prereqs, unlocked with 3/3; `addCount` strictly greater than
  every other boss-level tier's; `rewardCurrency` strictly greater than every
  other boss-level tier's; reward card ids exist in the card catalog; the
  level-map payload contains the citadel node.
- Full server suite (`pnpm test:quick` from `game/`) passes.

## Technical Specs

- `game/server/quests.js`: insert the quest right after `rift_convergence`
  (~line 705) following its exact shape (it is the reference boss-level
  capstone: levelKind/layoutProfile/unlockRequires-array/encounter). Multi-AND
  prerequisite arrays are already normalized by `normalizeUnlockRequires`
  (~line 1230) — a 3-element array is the same code path as rift's 2-element
  array; no framework changes expected.
- Do NOT set `arenaTheme` yet — that lands with the theme rendering in
  sub-ticket 04 so this diff stays scoped to quest data + gating.
- `game/server/test/rift_convergence_e2e.test.js`: the two supremacy tests at
  ~lines 233–256; also retitle the colossus stat test (~line 218) to
  "every other non-capstone stage boss" if wording would otherwise lie.
- `game/server/test/citadel_capstone_quest.test.js`: new file; model the
  gating setup on `quest_tier_gating.test.js` and the boss-level checks on
  `rift_convergence_e2e.test.js`'s definition section.
- The client level map (`game/client/levelMap.js`) is fully data-driven from
  the payload (column = prerequisite depth) — no client change in this ticket.
- Do NOT touch `simulation.js`, `debugScenarios.js`, `dungeon.js`, or client
  files.

## Verification: code
