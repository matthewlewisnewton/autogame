# Server named-rare variant plumbing

Add a server-side named-rare variant mechanism for scripted quest spawns: inline spawn config (`variant: { name, hpMult, damageMult, tint, scaleMult?, drop }`) is applied at spawn time, skips random affix rolling, scales combat stats, and grants a guaranteed unique reward on first kill per run.

## Acceptance Criteria

- `QuestScriptSpawn` entries may include an optional inline `variant` object; `normalizeQuestScriptSpawn` preserves it when valid.
- `spawnWaveEntries` passes the spawn's `variant` config into the enemy spawn path; enemies spawned without an inline variant are unchanged (still subject to existing affix `applyVariant` rolls).
- Enemies carrying a named rare expose a serializable `namedRare` field (e.g. `{ id, name, tint, scaleMult, drop }`) on the live enemy and in `stateSnapshot().enemies`; `enemy.variant` affix id stays `null` for named rares.
- `hpMult` / `damageMult` scale `hp`, `maxHp`, and `attackDamage` from `ENEMY_DEFS` at spawn; other base-type stats and AI behavior are unchanged.
- On death, the killing player's `runCardDropIds` (or currency loot) receives the configured unique drop **100% on first kill per run** for that named-rare `id`; subsequent kills of the same named-rare id in the same run do not re-grant it.
- Regular bulk-spawn and affix-variant enemies on unscripted quests are unaffected.
- Vitest covers: stat scaling, affix-roll skip, first-kill drop grant, and second-kill no-duplicate using a fixture scripted spawn (no production quest content required).

## Technical Specs

- **`game/server/quests.js`**: Extend `QuestScriptSpawn` typedef with optional `variant: { name, hpMult?, damageMult?, tint?, scaleMult?, drop: { cardId? | currency? } }`. Update `normalizeQuestScriptSpawn` to pass through a validated variant object (require non-empty `name` and a `drop` with `cardId` or positive `currency`).
- **`game/server/namedRareVariants.js`** (new): `applyNamedRareVariant(enemy, variantConfig, questContext)` — assign stable `namedRare.id` (slug from `name`), copy display fields, apply stat multipliers, force `enemy.variant = null`. Export helpers for drop resolution and first-kill tracking.
- **`game/server/questScript.js`**: In `spawnWaveEntries`, pass `spawn.variant` into `ctx.spawnEnemy` (extend spawn options).
- **`game/server/progression.js`**: Extend `spawnEnemy` opts with `namedRareVariant`; when present, call `applyNamedRareVariant` and **skip** `applyVariant`. Initialize `run.namedRareDropsClaimed` (array or Set) on run start. In `recordEnemyCardDrop` / `spawnCurrencyDrop`, consult named-rare drop config and `namedRareDropsClaimed` before granting.
- **`game/server/test/named_rare_variant.test.js`** (new): Fixture-tier scripted spawn with a `grunt` named rare; assert snapshot fields, scaled stats, and drop bookkeeping.

## Verification: code
