# 06 — Tier 2 squad ready/deploy gate

Quest selection is lobby-wide, but Tier-2 access is per account. Block ready-up and run start when Tier 2 is selected and any connected squad member lacks that tier unlock on their account.

## Acceptance Criteria

- When `selectedQuestTier >= 2`, `playerReady(true)` is rejected for a player whose own account lacks `isQuestTierUnlocked(accountId, selectedQuestId, tier)`; `player.ready` stays `false` and the socket receives a clear error (e.g. `questError` with `reason: 'tier_locked'`).
- `checkAllReady` does not transition to `playing` while Tier 2 is selected and any connected lobby player lacks the tier unlock, even if that player somehow has `ready: true`.
- Two-client integration test: player A unlocks and selects `training_caverns` Tier 2; player B (locked) emits `playerReady(true)` — deploy does not start (`startGame` not emitted), B remains not ready or receives `tier_locked`.
- Two-client integration test: when both accounts have Tier 2 unlocked and Tier 2 is selected, both ready → `startGame` fires and `run.questTier === 2`.
- Existing Tier-1 ready/deploy flows remain unchanged.
- `game/server/test/quest_tier_gating.test.js` (extended) or `quest_tier_lobby_sync.test.js` covers multi-player cases; `pnpm test:quick` passes.

## Technical Specs

- **`game/server/index.js`** — In `playerReady`, when `ready === true` and `state.selectedQuestTier >= 2`, validate the requesting player's account unlock before deck validation; emit `questError` / clear ready on failure.
- **`game/server/progression.js`** — In `checkAllReady`, before `setGamePhase(PLAYING)` / `createRunState`, if `(state.selectedQuestTier ?? 1) >= 2`, require every connected player with `ready: true` to pass `isQuestTierUnlocked(player.accountId, state.selectedQuestId, state.selectedQuestTier)`; if any fail, abort start and clear offending players' `ready` flags (mirror deck-validation patterns).
- **`game/server/users.js`** / **`game/server/quests.js`** — Use existing `isQuestTierUnlocked` / `isValidQuestSelection`; no persistence changes.
- **`game/server/test/quest_tier_gating.test.js`** — Add two-player cases using `connectClient` + separate temp user accounts (follow `integration.test.js` multi-socket patterns).
- Do **not** rework per-socket unlock payload emission here (sub-ticket 05).

## Verification: code
