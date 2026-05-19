# Audio Autoplay Resume & Mute Persistence

> **Staleness note.** This follow-up ticket was written against commit
> `dc999ac` (2026-05-19). The codebase may have moved on since it was filed —
> before acting, re-check every file path and code reference below
> against the CURRENT code, and skip any nit that is already resolved.

Minor, non-blocking improvements to the audio subsystem's robustness and user preferences handling.

## AudioContext autoplay resume

In `game/client/main.js`, `playSound()` lazily instantiates the `AudioContext`:
```js
if (!audioCtx) {
  const Ctx = window.AudioContext || window.webkitAudioContext;
  audioCtx = Ctx ? new Ctx() : null;
}
```

Under modern browser autoplay policies, creating an `AudioContext` without an active user gesture will place it in the `'suspended'` state. The current setup never attempts to `resume()` the context, meaning audio may remain completely muted indefinitely even after interaction begins.

### Acceptance Criteria
- Register an event listener (or leverage existing click/keypress handlers) that calls `audioCtx.resume()` if `audioCtx` is present and in the `'suspended'` state.
- Ensure playing a sound attempt handles suspended states gracefully without throwing uncaught exceptions.

## Mute button choice persistence

The user's mute choice (`soundEnabled`) is currently only saved in memory. When the page is reloaded, the preference is lost and the game reverts to unmuted by default.

### Acceptance Criteria
- Toggling the mute button should persist the choice in `localStorage`.
- On client start, retrieve the persisted setting from `localStorage` to initialize `soundEnabled`.
- Dynamically update the `#mute-btn` display text (`🔊` or `🔇`) on startup based on the persisted state.
- Existing tests for the mute button (e.g. in `game/client/test/main.test.js`) are updated to verify that `localStorage` is checked and written to correctly.
