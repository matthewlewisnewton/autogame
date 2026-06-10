# Per-quest signature card defs + victory reward selection on the server

Add optional `signatureCardId` / `rewardCards` to quest tier definitions and make
victory reward selection prefer the quest's own pool: the signature card is always
one of the post-victory card choices, and the empty-choices fallback rotates through
the quest's pool instead of the global `VICTORY_REWARD_ROTATION`. Quests without a
signature pool must behave exactly as today.

## Acceptance Criteria

- `game/server/quests.js` tier defs carry the new optional fields, using ONLY
  existing `acquisition: 'reward'` cards from `game/shared/cardDefs.json`:
  - `frost_crossing` tier 1: `signatureCardId: 'ice_ball'`,
    `rewardCards: ['ice_ball', 'frost_nova', 'permafrost_lance']` (ice/slow theme).
  - `ember_descent` tier 1: `signatureCardId: 'fireball'`,
    `rewardCards: ['fireball', 'dragons_breath']` (burn theme).
  - `spire_ascent` tiers 1 and 2: `signatureCardId: 'gravity_well'`,
    `rewardCards: ['gravity_well']` (pull/edge-control theme).
  - `crystal_rescue` tiers 1 and 2: `signatureCardId: 'mana_prism'`,
    `rewardCards: ['mana_prism', 'harvesting_scythe']` (utility theme).
  - `training_caverns`, `arena_trials`, `canyon_descent`, `endless_siege`: NO new
    fields (they keep global-rotation behavior).
- `game/server/quests.js` exports two new helpers (both exported in `module.exports`):
  - `getSignatureCardId(questId, tier)` → the tier's `signatureCardId`, falling back
    to `rewardCards[0]`, else `null`.
  - `getQuestRewardCards(questId, tier)` → the tier's non-empty `rewardCards` array,
    falling back to `[signatureCardId]` when only that is set, else `null`. Unknown
    quest/tier returns `null`.
- `buildCardChoices` in `game/server/progression.js` injects the active run's
  signature card (from `state.run.questId` / `state.run.questTier`) as the FIRST
  choice when the quest has one: deduplicated against run drops, total choices still
  capped at `MAX_CARD_CHOICES`. For runs of quests without a signature card, output
  is byte-for-byte identical to today.
- In `grantRunRewards` (victory path, `cardChoices.length === 0` fallback), the
  per-player rotation indexes into `getQuestRewardCards(...)` when the quest defines
  a pool, and into the global `VICTORY_REWARD_ROTATION` otherwise. The per-player
  `_victoryCounters` mechanism is preserved.
- `VICTORY_REWARD_ROTATION` and `SHOP_CARD_POOL` in `game/server/config.js` are NOT
  modified; existing tests referencing them still pass.
- New server vitest coverage proves:
  - winning `frost_crossing` produces `pendingCardChoices` containing `ice_ball`;
  - winning `training_caverns` produces choices that do NOT contain `ice_ball`
    (unless it was an actual run drop) and matches pre-change selection;
  - the empty-choices fallback grants a card from the quest pool for a signature
    quest and from `VICTORY_REWARD_ROTATION` for a non-signature quest.
- Full server test suite passes (`pnpm test:quick` from `game/`).

## Technical Specs

- `game/server/quests.js`:
  - Add the fields to the tier defs listed above (tier defs are spread into the
    quest object by `getQuest`, so the fields flow into resolved quests for free).
  - Implement and export `getSignatureCardId(questId, tier)` and
    `getQuestRewardCards(questId, tier)` next to the existing accessors
    (`getEnemyPool` / `getGuaranteedEnemyType` are the pattern to follow, including
    `normalizeQuestTier` use).
- `game/server/progression.js`:
  - `buildCardChoices(playerId, state)` (~line 1173): after collecting `uniqueIds`
    from `player.runCardDropIds`, look up the signature card for
    `state.run?.questId` / `state.run?.questTier` via the new quests.js helper;
    if present and valid in `CARD_DEFS`, unshift it (dedupe, then trim to
    `MAX_CARD_CHOICES`). Keep the existing early-return for missing player /
    non-array `runCardDropIds` (signature injection only applies when the normal
    choice-building path runs; note this also keeps `previewReturnRewards`
    consistent since it calls the same function).
  - `grantRunRewards` (~line 1301): in the `cardChoices.length === 0` branch,
    resolve `const pool = getQuestRewardCards(run.questId, run.questTier) ||
    VICTORY_REWARD_ROTATION;` and index the existing `_victoryCounters[playerId]`
    into `pool` instead of always `VICTORY_REWARD_ROTATION`.
- Tests: add `game/server/test/quest_signature_rewards.test.js` (or extend an
  existing progression/reward test file) using the existing test setup patterns from
  `game/server/test/card_acquisition.test.js`.
- Do NOT touch client files in this sub-ticket.

## Verification: code
