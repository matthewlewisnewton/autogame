# 06 — Client quest board uses tierUnlocked

The quest board currently locks tier-2+ cards using only the raw `unlockedQuestTiers` map (`isQuestTierUnlocked` in `questBoard.js`). Switch lock/disable UI to the server-evaluated `questVariants[].tierUnlocked` field so multi-prerequisite tiers stay locked when prerequisites are only partially met.

## Acceptance Criteria

- `renderQuestBoard` treats a tier-2+ row as locked when its matching `questVariants` entry has `tierUnlocked === false`, even if `unlockedQuestTiers[questId]` includes that tier.
- When `tierUnlocked === true` on the variant, the tier-2+ card is clickable (subject to `selectionLocked` as today).
- Tier 1 rows remain always unlocked; when `tierUnlocked` is absent on a variant (shared/catalog-only payload), fall back to the existing `unlockedQuestTiers` check for backward compatibility.
- `questBoardStructureKey` / incremental re-render path updates lock badges when `tierUnlocked` changes without requiring a full card rebuild regression.
- `applyQuestBoardFromPayload` in `main.js` continues to pass `questVariants` through to `renderQuestBoardState` (no stripping of `tierUnlocked`).
- `game/client/test/questBoard.test.js` covers: persisted unlock present + `tierUnlocked: false` → locked card; both prerequisites met + `tierUnlocked: true` → clickable card.
- `cd game && pnpm test:quick` passes.

## Technical Specs

- **`game/client/questBoard.js`** — Add a variant lookup (by `questId` + `tier`) and replace direct `isQuestTierUnlocked(unlockedQuestTiers, …)` lock checks with logic that prefers `variant.tierUnlocked` when defined. Update `questBoardStructureKey` to incorporate evaluated unlock state (e.g. serialized `tierUnlocked` flags from variants).
- **`game/client/main.js`** — Confirm `applyQuestBoardFromPayload` / `renderQuestBoardState` pass the full `questVariants` array from server payloads; adjust only if a field is dropped or overwritten.
- **`game/client/test/questBoard.test.js`** — New cases for multi-prereq partial vs full unlock using `tierUnlocked` on variant fixtures while `unlockedQuestTiers` holds the persisted tier.

## Verification: code
