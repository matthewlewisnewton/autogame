## Keep Server And Client Settings Defaults In Sync

The server settings module says its schema constants are kept in sync with `game/client/settings.js`, but the server default `gamepad` object omits the client default `modifierButton: 7`. This is non-blocking because the client merges server settings over its own defaults and the server accepts an explicitly saved `modifierButton`, but syncing the defaults would reduce future confusion.

### Acceptance Criteria
- `game/server/settings.js` and `game/client/settings.js` expose matching default settings for all currently supported fields, including `gamepad.modifierButton`.
