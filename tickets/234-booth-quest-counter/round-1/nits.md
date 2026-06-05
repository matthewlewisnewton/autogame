## Remove Unused Quest Booth Import
`game/client/main.js` imports `QUEST_BOOTH_ID` from `game/client/questBooth.js`, but the file only uses `isQuestBoothAction()`. Removing the unused import would keep the module tidy and avoid future lint noise if stricter checks are enabled.

### Acceptance Criteria
- `game/client/main.js` imports only the quest booth symbols it uses.
