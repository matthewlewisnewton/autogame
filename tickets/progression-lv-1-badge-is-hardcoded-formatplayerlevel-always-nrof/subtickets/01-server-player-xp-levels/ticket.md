# Server-tracked player XP and level

Add a real player XP/level stat to the server: kills and quest victories award XP, a deterministic curve converts XP to a level (starting at 1), the stat persists across sessions, and every state snapshot carries it so the client can display it. No client changes in this sub-ticket.

## Acceptance Criteria

- Each player has `xp` (number, starts 0) and `level` (number, starts 1) fields on the server player record.
- Killing an enemy awards XP to the killing player: in `removeDeadEnemies()` (`game/server/progression.js`), the player identified by `enemy.lastDamagedBy` (the same attribution already used by `recordEnemyCardDrop`) receives XP for each dying enemy. Enemies with no attributable killer award no XP and do not throw.
- Winning a run awards a flat victory XP bonus to every player in the lobby (hooked where `grantRunRewards` is called for `status === 'victory'`).
- A pure exported helper (e.g. `levelForXp(xp)` and `xpRequiredForLevel(level)`) defines the curve: level 1 at 0 XP, with cumulative thresholds `xpRequiredForLevel(n) = 100 * (n - 1) * n / 2` (level 2 at 100 XP, level 3 at 300, level 4 at 600, …). `player.level` is recomputed from `player.xp` whenever XP is awarded; it never decreases and never goes below 1.
- Kill XP scales with the enemy: `Math.max(5, Math.round((enemy.maxHp || 30) / 6))` (trash ≈ 5, stage bosses ≈ 50–77). Victory bonus is 50 XP per player.
- `xp` and `level` persist: included in `extractPersistentData()` (`game/server/progression.js`) and restored from `savedData` in `buildPlayerRecord()` (`game/server/index.js`); a fresh player with no saved data starts at xp 0 / level 1.
- `buildPlayerHotSnapshot()` includes `level` and `xp` so every `STATE_UPDATE` snapshot carries them.
- New test file `game/server/test/player_level.test.js` covers: the level curve helper (level 1 at 0 XP, level 2 at exactly 100, level 3 at 300), kill XP attribution via `lastDamagedBy`, no-killer kills awarding nothing, victory bonus XP, level increasing when a threshold is crossed, persistence round-trip (extract → restore), and snapshot inclusion.
- Existing server tests still pass (`pnpm test:quick` from `game/`).

## Technical Specs

Files to change (all under `game/`):

- `game/server/progression.js`
  - Add XP/level constants and pure helpers `xpRequiredForLevel(level)` / `levelForXp(xp)` plus an `awardXp(player, amount)` helper that adds XP, recomputes `player.level = Math.max(player.level || 1, levelForXp(player.xp))`, and sets `player.persistenceDirty = true`. Export the helpers (add to the existing `module.exports` block) for tests and for the victory hook.
  - `createPlayerProgress()`: add `xp: 0, level: 1`.
  - `removeDeadEnemies()`: inside the existing `for (const enemy of dying)` loop, look up `_gameState.players[enemy.lastDamagedBy]` and call `awardXp(player, killXpForEnemy(enemy))` when the player exists. Use `Math.max(5, Math.round((enemy.maxHp || 30) / 6))` for the per-enemy amount (small helper `killXpForEnemy(enemy)` is fine).
  - Victory hook: in `checkRunTerminalState()` (or inside `grantRunRewards` on the `victory` branch — pick one place only), award 50 XP to each player. Note `savePlayerData` is already called for all players right after `grantRunRewards`, so persistence is automatic.
  - `extractPersistentData()`: add `xp: Number.isFinite(player.xp) ? player.xp : 0` and `level: Number.isFinite(player.level) ? player.level : 1`.
  - `buildPlayerHotSnapshot()`: add `level: Number.isFinite(p.level) ? p.level : 1` and `xp: Number.isFinite(p.xp) ? p.xp : 0`.
- `game/server/index.js`
  - `buildPlayerRecord()`: initialize `xp: progress.xp, level: progress.level` in the player literal; in the `if (savedData)` block restore `player.xp = savedData.xp ?? 0` and recompute `player.level` via `levelForXp` (import it from `./progression` alongside the existing imports) so the level can never disagree with the saved XP.
- `game/server/test/player_level.test.js` (new)
  - Follow the patterns of existing tests in `game/server/test/` (they import state-driven sim fns from `index.js` / use progression test hooks). Cover the bullets in Acceptance Criteria.

Notes:
- Do NOT gate quest tiers or any other content on level in this sub-ticket — `unlockQuestTier` behavior must not change.
- Minion kills already attribute via `enemy.lastDamagedBy = minion.ownerId`, so they award XP to the owner without extra work.
- Level must survive `returnPlayersToLobby()` — that function rebuilds some player fields; XP/level live directly on the player object and are not in the preserved-fields list it overwrites, so no change should be needed there, but the persistence round-trip test should catch regressions.

## Verification: code
