# 04 — Quest payload exposure and integration tests

Expose prerequisite-aware unlock state in quest update payloads so clients receive per-variant lock information derived from the same `isQuestTierUnlocked` logic as the server gate. Add integration coverage for array-shaped `unlockRequires` flowing through `buildQuestUpdatePayload`.

## Acceptance Criteria

- `buildQuestUpdatePayload(gameState, playerAccountId)` enriches each `questVariants` row with `tierUnlocked: boolean` when `playerAccountId` is provided, computed via `isQuestTierUnlocked(playerAccountId, variant.questId, variant.tier)`.
- `buildSharedQuestUpdatePayload` / payloads without an account id do **not** add `tierUnlocked` (shared catalog remains account-agnostic).
- `listQuestVariants()` continues to pass through `unlockRequires` from tier defs (single object or array); array-authored defs appear as arrays in the payload.
- `getUnlockedQuestTiers(accountId)` still returns the raw persisted map (unchanged persistence semantics); effective gating is exposed via `tierUnlocked` on variants.
- `game/server/test/quests.test.js` asserts `tierUnlocked` on a player payload for a known locked vs unlocked tier-2 variant.
- `game/server/test/unlock_prereqs.test.js` (or a dedicated integration test) asserts a multi-prereq fixture quest: `tierUnlocked` is `false` with one prereq completed, `true` with both completed and persisted tier-2 unlock.
- `cd game && pnpm test:quick` passes.

## Technical Specs

- **`game/server/quests.js`** — Update `buildQuestUpdatePayload` to map `questVariants` and attach `tierUnlocked` using lazy `require('./users').isQuestTierUnlocked` (same pattern as `getUnlockedQuestTiers`). Optionally add `listQuestVariantsForAccount(accountId)` if it keeps `buildQuestUpdatePayload` readable.
- **`game/server/test/quests.test.js`** — Extend `buildQuestUpdatePayload` tests with a temp user + `unlockQuestTier` setup.
- **`game/server/test/unlock_prereqs.test.js`** — Socket or payload-level integration for multi-prereq `tierUnlocked` and `unlockedQuestTiers` coexistence.
- **`game/client/questBoard.js`** — Out of scope for this ticket; server payload must be correct even if the client still keys only on `unlockedQuestTiers`.

## Verification: code
