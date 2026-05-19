# Rename misleading defeat-count variables

The three enemy-defeat accounting sites in `game/server/index.js` use local variables named `defeatedMinion`, `defeatedWeapon`, `defeatedSummon` that actually hold the *pre-filter* enemy count (before dead enemies are removed), not a defeated count. Rename them to convey "count before removal" to prevent future misreading.

## Acceptance Criteria
- `defeatedMinion` is renamed to `enemiesBeforeCleanup` (or equivalent) at the minion cleanup site (~line 819)
- `defeatedWeapon` is renamed to `enemiesBeforeCleanup` (or equivalent) at the weapon card site (~line 1040)
- `defeatedSummon` is renamed to `enemiesBeforeCleanup` (or equivalent) at the summon card site (~line 1096)
- Corresponding `*Count` variables are also renamed consistently (e.g. `defeatedCount`)
- All existing tests pass; no behavioral change

## Technical Specs
- **File:** `game/server/index.js`
- Rename `defeatedMinion` → `enemiesBeforeCleanup` and `defeatedMinionCount` → `defeatedCount` (line ~819-823)
- Rename `defeatedWeapon` → `enemiesBeforeCleanup` and `defeatedWeaponCount` → `defeatedCount` (line ~1040-1044)
- Rename `defeatedSummon` → `enemiesBeforeCleanup` and `defeatedSummonCount` → `defeatedCount` (line ~1096-1100)

## Verification: code
