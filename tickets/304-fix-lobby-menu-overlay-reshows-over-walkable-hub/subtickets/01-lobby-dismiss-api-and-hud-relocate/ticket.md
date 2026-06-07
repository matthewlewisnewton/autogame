# Lobby dismiss API and persistent lobby HUD

Introduce an explicit dismiss/show contract for the `#lobby` menu overlay and relocate non-menu lobby chrome (suspended-run banner, resume/abandon, leave channel) outside the dismissible panel so those controls stay reachable while the walkable hub is unobstructed.

## Acceptance Criteria

- `dismissGameLobby()` hides `#lobby` (adds `.hidden`), sets a module-level dismissed flag, and is wired to a visible close control (`#lobby-close-btn`) plus Escape while the lobby menu is open.
- `showGameLobby()` clears the dismissed flag and removes `.hidden` from `#lobby` (explicit open only).
- `#suspended-run-banner`, `#resume-run-btn`, `#abandon-run-btn`, and `#leave-lobby-btn` render and remain usable when `#lobby` is dismissed (moved to a persistent container such as `#lobby-hud` or `#ui`, not children of the hidden menu panel).
- Test hooks exist: `window.dismissGameLobby`, `window.showGameLobby`, and `window.__getLobbyMenuDismissed()` (or equivalent) for unit tests.
- Existing auth/lobby-browser hide paths still hide `#lobby` as today.

## Technical Specs

- `game/client/index.html`: add `#lobby-close-btn` in the lobby header; move suspended-run / resume / abandon / leave-lobby elements out of the dismissible `#lobby` menu wrapper into a sibling HUD container.
- `game/client/main.js`: add `lobbyMenuDismissed` flag, `dismissGameLobby()`, update `showGameLobby()` to clear the flag; wire close button + Escape handler; update `resumeRunBtn` / `abandonRunBtn` / `suspendedRunBannerEl` / `leaveLobbyBtn` element references if DOM ids move.
- `game/client/style.css`: style the close button and persistent `#lobby-hud` (position above canvas, below Vanguard HUD z-index); ensure dismissed `#lobby` uses existing `.hidden` (`display: none`) so it does not intercept pointer events over the canvas.

## Verification: code
