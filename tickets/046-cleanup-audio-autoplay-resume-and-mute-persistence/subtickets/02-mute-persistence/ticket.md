# Mute Button Persistence via localStorage

The user's mute preference (`soundEnabled`) is lost on page reload. Persist the choice in `localStorage` so it survives navigation and page refreshes.

## Acceptance Criteria

- Clicking the mute button writes the new `soundEnabled` value to `localStorage` under a stable key (e.g. `'autogame:mute'` or `'autogame:soundEnabled'`).
- On client startup, `soundEnabled` is initialized from the `localStorage` value (defaulting to `true` if absent).
- `updateMuteButton()` reflects the restored state on page load (correct `🔊` / `🔇` emoji).
- Tests in `game/client/test/main.test.js` verify that `localStorage` is both read on init and written on toggle.
- `localStorage` access is wrapped in try/catch (some browsers block it in private mode).

## Technical Specs

- **File:** `game/client/main.js`
  - Replace `let soundEnabled = true;` with a read from `localStorage` (with fallback to `true`).
  - In the mute click handler (the delegated `click` listener on `document`), call `localStorage.setItem()` after toggling `soundEnabled`.
  - Expose a test helper: `window.__getPersistedMute = () => localStorage.getItem('autogame:soundEnabled');` (or whatever key is chosen).
- **File:** `game/client/test/main.test.js`
  - Add tests: (a) `localStorage` is checked on init, (b) toggling mute writes to `localStorage`, (c) button text matches persisted state.
  - Use `beforeEach` / `afterEach` to clear `localStorage` and reset `soundEnabled` to avoid test pollution.

## Verification: code
