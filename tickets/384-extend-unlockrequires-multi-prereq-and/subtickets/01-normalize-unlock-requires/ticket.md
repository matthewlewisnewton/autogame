# 01 — Normalize unlockRequires schema

Add a shared normalizer in `quests.js` so tier definitions may author `unlockRequires` as either a single `{ questId, tier }` object (today's form) or an array of those objects (AND semantics). Export the helper for later unlock evaluation; do not change unlock gating behavior in this sub-ticket.

## Acceptance Criteria

- `normalizeUnlockRequires(raw)` is exported from `game/server/quests.js`.
- Passing a single valid `{ questId, tier }` returns a one-element array with normalized positive integer `tier` and string `questId`.
- Passing an array of valid entries returns the same entries normalized; invalid/missing entries are dropped.
- Passing `null`, `undefined`, or non-object values returns `null` (meaning no prerequisites).
- Existing tier-2 defs in `QUEST_DEFS` keep their single-object `unlockRequires` authoring unchanged.
- A tier def authored with an array `unlockRequires` round-trips through `getQuest()` and `listQuestVariants()` unchanged (still object or array as stored).
- Unit tests in `game/server/test/quests.test.js` cover single-object, array, empty, and invalid inputs for `normalizeUnlockRequires`.
- `cd game && pnpm test:quick` passes.

## Technical Specs

- **`game/server/quests.js`** — Add JSDoc for `UnlockRequires` (single object or array). Implement and export `normalizeUnlockRequires`. Re-export from `module.exports`.
- **`game/server/test/quests.test.js`** — New `describe('normalizeUnlockRequires')` block; no changes to `isQuestTierUnlocked` or socket handlers yet.

## Verification: code
