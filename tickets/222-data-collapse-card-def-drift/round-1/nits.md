## Refresh Stale Card Module Comments

`game/client/cards.js` still has a couple of comments that describe the shared import as an "identity subset" and mention old card type examples like `summon` / `monster`. The code is correct, but the comments now lag the shared full-stat data model and may confuse future card-data work.

### Acceptance Criteria
- Comments in `game/client/cards.js` accurately describe `game/shared/cardDefs.json` as the full shared card stat source and list the current card types.
