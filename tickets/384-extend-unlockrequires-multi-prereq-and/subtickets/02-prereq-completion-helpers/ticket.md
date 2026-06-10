# 02 — Prerequisite completion helpers

Implement server-side helpers that decide whether an account has **completed** each prerequisite quest tier. These helpers use the persisted `unlockedQuestTiers` map (tier 1 completion is indicated by tier 2 being present for that quest id) and compose with `normalizeUnlockRequires` from sub-ticket 01.

## Acceptance Criteria

- `hasCompletedQuestTier(accountId, questId, tier)` is exported from `game/server/users.js` (or `quests.js` if you avoid a circular import — prefer `users.js` since it already reads the unlock map).
- Completing tier 1 of a quest (`unlockQuestTier(accountId, questId, 2)` after a tier-1 victory) makes `hasCompletedQuestTier(accountId, questId, 1)` return `true`.
- `hasCompletedQuestTier` returns `false` for unknown accounts, invalid quest/tier pairs, and tiers not yet completed.
- `areUnlockPrereqsMet(accountId, unlockRequires)` is exported; it normalizes `unlockRequires` via `normalizeUnlockRequires` and returns `true` only when **every** prerequisite is completed (AND logic). `null`/missing prerequisites return `true`.
- Unit tests in a new `game/server/test/unlock_prereqs.test.js` cover: zero prereqs, single prereq met/unmet, two-prereq AND (one met / both met), and backward-compatible single-object input.
- `cd game && pnpm test:quick` passes.

## Technical Specs

- **`game/server/users.js`** — Add `hasCompletedQuestTier` and `areUnlockPrereqsMet`; import `normalizeUnlockRequires` from `./quests`. Export both functions.
- **`game/server/test/unlock_prereqs.test.js`** — New vitest file using the existing `users.setTestFilePath` / `clearUsers` / `unlockQuestTier` patterns from `quest_tier_unlock_persistence.test.js`.
- Do **not** modify `isQuestTierUnlocked` or quest payloads in this sub-ticket.

## Verification: code
