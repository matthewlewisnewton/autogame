# 04 — Quest board Tier 2 selection UI

Surface Tier 2 contract rows on the lobby quest board when the local account has unlocked them, show a locked state before unlock, and send tier with quest selection. Display the active tier in run/lobby summaries where quest name is shown.

## Acceptance Criteria

- After login/join, client stores `unlockedQuestTiers` from server payloads and keeps it in sync on `questUpdate` / `lobbyJoined`.
- `renderQuestBoard` lists Tier 1 rows for all quests and Tier 2 rows only for variants present in the catalog; Tier 2 rows use a visible locked state (disabled, label, or badge) when not in `unlockedQuestTiers`, and are clickable when unlocked.
- Selecting a row calls `socket.emit('selectQuest', { questId, tier })` with the correct tier; server errors surface via existing `questError` UI.
- Selected row highlights match both `questId` and `tier` (not Tier 1 when Tier 2 is selected).
- Run summary / objective HUD / suspended-run copy includes Tier 2 indication when `questTier === 2` (e.g. “Initiate Vault (Tier 2)” using server run fields).
- `game/client/test/questBoard.test.js` covers locked vs unlocked Tier 2 rendering and selection callback payload; `pnpm test:quick` passes.

## Technical Specs

- **`game/client/questBoard.js`** — Accept `unlockedQuestTiers`, `selectedQuestTier`, and variant-shaped `quests` list; render Tier 2 rows; `onSelectQuest(questId, tier)`.
- **`game/client/main.js`** — Track `selectedQuestTier` and `unlockedQuestTiers`; wire `applyQuestBoardState`, `renderQuestBoardState`, `questUpdate` / `lobbyJoined` handlers; pass tier into `selectQuest`; update HUD strings from `gameState.run.questTier` or snapshot fields.
- **`game/client/test/questBoard.test.js`** — Fixtures with `training_caverns` Tier 2 variant.
- Minimal CSS only if existing quest-card styles cannot show locked Tier 2 (prefer classes over new stylesheets).
- No new level-specific dungeon content; Tier 2 remains a framework stub on the server.

## Verification: code
