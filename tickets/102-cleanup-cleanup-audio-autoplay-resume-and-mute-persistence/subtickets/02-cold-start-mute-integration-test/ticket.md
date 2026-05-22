# Cold-start mute icon integration test

Add an integration test that proves the full startup wiring: when `localStorage` has `autogame:soundEnabled` set to `'false'` **before** the module is first imported, the `soundEnabled` variable initializes to `false` and the `#mute-btn` displays `🔇` — all without any user click.

Current mute persistence tests call `__loadSoundEnabled()` after `import('../main.js')`, but Vitest caches the module so the top-level `let soundEnabled = loadSoundEnabled()` never re-runs. This test uses `vi.resetModules()` to clear the cache and simulate a true cold start.

## Acceptance Criteria

- A test calls `vi.resetModules()`, pre-seeds `localStorage.setItem('autogame:soundEnabled', 'false')`, then `await import('../main.js')`.
- After import, `window.__soundEnabled()` returns `false` (proving the module-level `loadSoundEnabled()` read the persisted value).
- After import, `document.getElementById('mute-btn').textContent` is `🔇` (proving the mute button reflects the loaded state).
- No clicks or user interaction are performed — the state is correct on cold start.
- All existing tests continue to pass.

## Technical Specs

- **File:** `game/client/test/main.test.js`
- Add a new `describe('Cold-start mute persistence', ...)` block.
- Use `vi.resetModules()` in the test to clear Vitest's module cache before importing.
- Pre-seed `localStorage` **before** the `import('../main.js')` call.
- Assert `window.__soundEnabled()` is `false` and `#mute-btn` text content is `🔇`.
- Clean up in `afterEach`: clear `localStorage` and call `vi.resetModules()` to avoid polluting other tests.

## Verification: code
