## Defensively Copy Admin Roster Data

`buildAdminRoster()` currently returns nested account and persisted objects/arrays by reference. The current `/admin` view only renders them and does not mutate state, but returning cloned nested data would better match the read-only contract and reduce future foot-guns if another caller reuses the roster aggregation.

### Acceptance Criteria
- `buildAdminRoster()` returns cloned copies of nested fields such as `cosmetic`, `unlockedHats`, `unlockedQuestTiers`, `selectedDeck`, and `ownedCards`.
- Existing admin roster and admin view tests still pass, with at least one assertion that mutating a returned roster entry does not mutate the underlying user or persisted player data.
