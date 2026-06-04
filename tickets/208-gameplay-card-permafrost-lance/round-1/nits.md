## Refresh New Card Pack Test Wording

`game/server/test/new_card_pack.test.js` still names one definition test "all eleven new cards" and keeps `newCardIds` limited to the older pack list even though Permafrost Lance now has separate assertions. This is non-blocking, but updating the wording/list would make the test easier to read for future card additions.

### Acceptance Criteria
- The new-card-pack definition test wording and helper list accurately reflect the current card pack, including `permafrost_lance` or intentionally scoping it to legacy pack cards.
