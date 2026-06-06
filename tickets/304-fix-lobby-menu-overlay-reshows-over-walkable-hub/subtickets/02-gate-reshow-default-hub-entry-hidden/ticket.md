# Gate lobby re-show and default to hidden on hub entry

Stop the lobby menu from auto-opening on every lobby-phase tick. Hub join and ongoing `stateUpdate` / `returnToGuildLobby` sync must respect the dismiss flag so the walkable 3D hub stays visible while the player moves.

## Acceptance Criteria

- Joining a lobby in the `lobby` phase (`applyLobbyJoinedData` after `renderHubScene`) leaves `#lobby` dismissed/hidden by default — `__AUTOGAME_HARNESS_STATE__().lobbyVisible === false` with `phase === 'lobby'`, `hasCanvas === true`, and hub layout profile `'hub'`.
- `returnToGuildLobby()` no longer unconditionally calls `showGameLobby()`; it skips re-showing when `lobbyMenuDismissed` is true while still running collection refresh, quest-board sync, suspended-run banner, and hub rebuild logic.
- Repeated `STATE_UPDATE` events during the lobby phase (same phase, no transition) do not remove `.hidden` from `#lobby` when the menu was dismissed.
- Phase transitions that legitimately need the menu (e.g. first open after explicit user action) still call `showGameLobby()`; leaving the channel / returning to `#lobby-browser` resets the dismissed flag so the browser overlay behaves as before.
- `showExtractedLobbyOverlay()` may force-show the menu for extracted-waiting UX, but must not create a dismiss/reshow loop on subsequent `stateUpdate` ticks while extracted.

## Technical Specs

- `game/client/main.js`:
  - `applyLobbyJoinedData`: replace bare `showGameLobby()` on lobby-phase join with `dismissGameLobby()` (or equivalent) after hub render; keep `showGameLobby()` only where an explicit open is intended (debug booth hooks may still open on demand).
  - `returnToGuildLobby`: gate `showGameLobby()` behind `!lobbyMenuDismissed`; extract lobby chrome sync (HUD, deploy/resume visibility, banners) so it runs regardless of menu visibility.
  - `STATE_UPDATE` handler (`bindSocketHandlers`): verify the `state.gamePhase === 'lobby'` branch does not bypass the dismiss guard.
  - Reset `lobbyMenuDismissed = false` when returning to `#lobby-browser` (`showLobbyBrowser` / leave-lobby path).
- `game/client/main.js` `__AUTOGAME_HARNESS_STATE__`: expose `lobbyMenuDismissed` alongside existing `lobbyVisible`.

## Verification: code
