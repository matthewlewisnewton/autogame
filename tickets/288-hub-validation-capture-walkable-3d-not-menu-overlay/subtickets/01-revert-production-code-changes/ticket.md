# 01-revert-production-code-changes

Revert all test-only affordances added to `game/client/main.js` during round 1. The MutationObserver, `withLobbyGuard()`, `_gameModifyingLobby`, and `__testKeepLobbyDismissed` guard were baked into production code solely to keep the harness's `.hidden` class sticky against the ~20Hz STATE_UPDATE re-show. They must be removed — the harness will own dismissal entirely via CSS injection (next sub-ticket).

## Acceptance Criteria

- `game/client/main.js` contains **no** reference to `MutationObserver`, `withLobbyGuard`, `_gameModifyingLobby`, `__testKeepLobbyDismissed`, or `_gameModifyingLobby`
- All seven `withLobbyGuard(() => { lobbyEl.classList.add('hidden'); })` call sites are reverted to plain `if (lobbyEl) lobbyEl.classList.add('hidden');`
- `showGameLobby()` reverts to unconditionally removing `.hidden` from `#lobby` (no `__testKeepLobbyDismissed` guard)
- The block comment describing the sticky-dismiss guard (lines ~368–377) is removed
- The `MutationObserver` instantiation block (lines ~384–397) is removed
- The `withLobbyGuard` function and `_gameModifyingLobby` variable declarations are removed
- No other production code is changed — only the test-only additions are stripped

## Technical Specs

- **File to change:** `game/client/main.js`
- Remove the `_gameModifyingLobby` variable and `withLobbyGuard()` function (~lines 379–383)
- Remove the `MutationObserver` block on `lobbyEl` (~lines 384–397)
- Remove the sticky-dismiss doc comment (~lines 368–377)
- Revert `showGameLobby()` line `if (lobbyEl && !window.__testKeepLobbyDismissed)` to `if (lobbyEl)`
- Unwrap all 7 `withLobbyGuard` call sites:
  - `showAuthOverlay()` — line ~321
  - `showLobbyBrowser()` — line ~401
  - socket CONNECT handler (initScene path) — line ~845
  - token-expired reconnect path — line ~1139
  - stateUpdate playing-phase path — line ~1274
  - START_GAME handler — line ~1808
  - disconnect handler — line ~3921

Each `withLobbyGuard(() => { lobbyEl.classList.add('hidden'); })` becomes `if (lobbyEl) lobbyEl.classList.add('hidden');`
Each `withLobbyGuard(() => { if (lobbyEl) lobbyEl.classList.add('hidden'); })` becomes `if (lobbyEl) lobbyEl.classList.add('hidden');`

## Verification: code
