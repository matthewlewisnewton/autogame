# 02 — Per-account Tier 2 unlock persistence

Persist which quest Tier 2 variants each account has unlocked, mirroring the `unlockedHats` pattern in `users.js`. Tier 1 is never stored (always available). Writes survive server restart.

## Acceptance Criteria

- New user records include an empty `unlockedQuestTiers` map (quest id → array of unlocked tier numbers, or equivalent deduped structure).
- `loadUsers()` backfills missing/invalid `unlockedQuestTiers` to `{}` on legacy records.
- `unlockQuestTier(accountId, questId, tier)` validates the quest/tier exists in the catalog (via `quests.js` helpers), appends unlock idempotently, persists to disk, and returns `{ ok: true, unlockedQuestTiers }` or `{ ok: false, reason }`.
- `isQuestTierUnlocked(accountId, questId, tier)` returns `true` for Tier 1 on valid quests; Tier 2 only when recorded on the account.
- `game/server/test/quest_tier_unlock_persistence.test.js` (new) covers create, unlock, idempotent re-unlock, and reload-from-disk without using sockets.

## Technical Specs

- **`game/server/users.js`** — Add `unlockedQuestTiers` to `createUser` / `createUserAsync`; `backfillUnlockedQuestTiers()`; `unlockQuestTier`, `isQuestTierUnlocked`, `getUnlockedQuestTiers(accountId)`; export new functions.
- **`game/server/quests.js`** — Import only validation helpers (`isValidQuestSelection` / `getQuest`) for unknown-tier guards; no victory or lobby logic.
- **`game/server/test/quest_tier_unlock_persistence.test.js`** — Use a temp `USERS_FILE` like `hat_unlock_persistence.test.js`.
- Do **not** wire socket handlers, victory rewards, or quest board UI in this sub-ticket.

## Verification: code
