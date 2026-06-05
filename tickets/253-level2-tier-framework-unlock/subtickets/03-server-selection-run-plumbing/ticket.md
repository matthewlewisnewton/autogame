# 03 — Server selection, run state, and victory unlock

Wire Tier 2 through lobby selection, run lifecycle, checkpoints, and quest-update payloads. Grant Tier 2 on the account when a player earns **victory** on Tier 1 of that quest. Reject locked Tier 2 selections at the socket layer.

## Acceptance Criteria

- `createGameState()` includes `selectedQuestTier: 1`; run snapshots and `createRunState()` record `questTier` (or equivalent) from lobby selection.
- `selectQuest` accepts `{ questId, tier }` (tier defaults to `1`). Unknown quest/tier emits `questError`. Tier 2 without `isQuestTierUnlocked(accountId, questId, 2)` for the requesting player emits `questError` with a clear reason (e.g. `tier_locked`).
- Successful selection updates `selectedQuestId`, `selectedQuestTier`, layout via `applyLayoutForQuest(state, questId, tier)`, and broadcasts `questUpdate` + `stateUpdate`.
- `buildQuestUpdatePayload` includes `selectedQuestTier`, variant list from `listQuestVariants()`, and per-joining-player `unlockedQuestTiers` (or enough data for the client to know which rows are unlocked for the local account).
- `captureRunCheckpoint` / `restoreRunCheckpoint` preserve `selectedQuestTier` and run `questTier`.
- On `runComplete` with `status === 'victory'` and `run.questTier === 1`, call `unlockQuestTier` for each in-run player’s `accountId` for that `questId` tier `2` (idempotent).
- `game/server/test/quest_tier_gating.test.js` (new) covers: Tier 2 select rejected before unlock; allowed after manual `unlockQuestTier`; victory on Tier 1 unlocks Tier 2 on disk. `pnpm test:quick` passes.

## Technical Specs

- **`game/server/game-state.js`** — `selectedQuestTier: 1`.
- **`game/server/index.js`** — `applyLayoutForQuest(state, questId, tier)`; `socket.on('selectQuest')` tier validation and state writes; include unlock map in `emitLobbyJoined` / quest payloads where needed.
- **`game/server/progression.js`** — `createRunState`, `captureRunCheckpoint`, `restoreRunCheckpoint`, `stateSnapshot`, `buildRunSummary`, `checkRunTerminalState` / victory path: tier field + `unlockQuestTier` via `users.js`.
- **`game/server/quests.js`** — `buildQuestUpdatePayload(gameState, playerAccountId?)` if needed to attach unlock hints.
- **`game/server/lobbies.js`** / **`game/server/test/lobbies.test.js`** — Update expectations if lobby summary exposes `selectedQuestTier`.
- **`game/server/test/quest_tier_gating.test.js`** — Prefer integration-style tests with test provider + temp users file; follow `integration.test.js` `selectQuest` patterns.
- Do **not** change client rendering in this sub-ticket (server may be verified via tests only).

## Verification: code
