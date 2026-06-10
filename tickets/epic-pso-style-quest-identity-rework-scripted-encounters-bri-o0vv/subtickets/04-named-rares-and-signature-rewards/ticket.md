# 04 — Named rare spawns and per-quest signature rewards

Support quest-exclusive named enemy pulls (fixed display name + optional forced variant) and quest-stated signature card rewards instead of the global `VICTORY_REWARD_ROTATION` fallback.

## Acceptance Criteria

- Scripted wave `spawns[]` entries accept `namedRare: { id, displayName, variantId?, enemyType? }`; when present, the spawned enemy uses the quest display name (surfaced to clients as `enemy.displayName` or lock-on label) and skips random variant rolling when `variantId` is set.
- `spawnEnemy` in `game/server/progression.js` honors `opts.displayName`, `opts.forceVariant`, and `opts.skipVariantRoll` without breaking existing spawns.
- Quest tier field `rewardCardId` (must exist in `game/shared/cardDefs.json` with `acquisition: 'reward'`) causes victory grants to award that card directly when `buildCardChoices` returns empty — **before** indexing `VICTORY_REWARD_ROTATION` in `grantRunRewards`.
- `formatRewardSummary` / client `formatRewardSummary` show `Reward: <Card Name>` (plus currency stones if both are granted).
- Quest board reward line reflects the signature card for quests that declare `rewardCardId`.
- Named rare kills still count toward scripted/defeat objectives; variant behavior (e.g. `volatile`, `warded`) applies when `variantId` is set.
- `cd game && pnpm test:quick` passes, including `game/server/test/named_rares.test.js` and `game/server/test/signature_rewards.test.js` (or combined file).

## Technical Specs

- **Edit:** `game/server/progression.js` — extend `spawnEnemy` opts; update `grantRunRewards` and `previewReturnRewards` to prefer `quest.rewardCardId`.
- **Edit:** `game/server/enemyVariants.js` — `applyForcedVariant(enemy, variantId)` helper used when spawn opts request it.
- **Edit:** `game/server/scriptedEncounters.js` — pass named-rare opts into `spawnEnemy` for matching spawn entries.
- **Edit:** `game/server/quests.js` — `rewardCardId` on tier defs; `formatRewardSummary` uses `CARD_DEFS[rewardCardId].name`.
- **Edit:** `game/client/questBoard.js` — reward summary shows card name when present in quest payload.
- **Edit:** `game/client/lockOn.js` and/or `game/client/renderer.js` — prefer `enemy.displayName` over `ENEMY_DEFS[type].name` when set.
- **Edit:** `game/server/simulation.js` — ensure enemy snapshots/state include `displayName` if added.
- **Add:** server tests covering forced variant spawn + victory card grant path.
- **Reuse:** `VICTORY_REWARD_ROTATION` in `game/server/config.js` remains the fallback for quests without `rewardCardId`.

## Verification: code
