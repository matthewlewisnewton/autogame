## Normalize Socket Handler Formatting

Some callback bodies in the newly extracted `game/server/socketHandlers/deck.js` and `game/server/socketHandlers/trade.js` retained the old inline indentation after being moved out of `index.js`. The code runs correctly, but reindenting those blocks would make future reviews and edits easier.

### Acceptance Criteria
- `game/server/socketHandlers/deck.js` and `game/server/socketHandlers/trade.js` use consistent indentation for nested socket callbacks.
- Formatting-only changes do not alter socket event behavior or test expectations.
