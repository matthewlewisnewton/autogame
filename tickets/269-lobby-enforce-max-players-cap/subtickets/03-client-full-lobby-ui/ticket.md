# 03-client-full-lobby-ui

Update the lobby-finder UI to show a "Full" label instead of a Join/Drop In button when a lobby has reached the player cap, and handle the server `lobbyError: "Lobby is full"` by displaying the error to the user.

## Acceptance Criteria

- Lobbies with `playerCount >= 16` show a "Full" label (or similar) instead of a clickable Join/Drop In button in the lobby list.
- The "Full" label is visually distinct from the Join/Drop In buttons (e.g., disabled appearance or different text color).
- If a user somehow triggers a join on a full lobby (race condition), the `lobbyError` handler displays the server error message.
- The `MAX_LOBBY_PLAYERS` threshold is available on the client (either hardcoded as `16` or received from the server via lobby summary data).

## Technical Specs

- **File:** `game/client/main.js`
  - In `renderLobbyList()`, check `lobby.playerCount >= 16` for each lobby entry.
  - When full, render a disabled button or span with text "Full" instead of the Join/Drop In button.
  - The existing `lobbyError` handler already calls `showLobbyBrowserError(reason)` — no change needed there unless the error text needs formatting.
  - Consider adding `MAX_LOBBY_PLAYERS = 16` as a client-side constant (or derive from lobby summary if server starts sending it).

## Verification: code
