# 01-add-max-players-constant

Add `MAX_LOBBY_PLAYERS = 16` constant to the server configuration and export it so other modules can reference the lobby capacity cap.

## Acceptance Criteria

- `MAX_LOBBY_PLAYERS` is defined as `16` in `game/server/config.js`.
- `MAX_LOBBY_PLAYERS` is exported from `game/server/config.js` in the `module.exports` object.
- No game code besides the constant definition is changed.

## Technical Specs

- **File:** `game/server/config.js` — add `const MAX_LOBBY_PLAYERS = 16;` alongside other capacity-related constants (near `DECK_MAX_SIZE` or `DISCONNECT_GRACE_MS`), and add it to the `module.exports` object.

## Verification: code
