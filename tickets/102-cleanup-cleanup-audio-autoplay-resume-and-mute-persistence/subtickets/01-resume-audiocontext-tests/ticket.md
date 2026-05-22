# Unit tests for resumeAudioContext()

Add unit tests for the `resumeAudioContext()` helper and its call from `playSound()`. The function is currently only verified by code inspection — these tests lock in the guard logic so future refactors cannot drop the resume call.

## Acceptance Criteria

- A test creates a mock `AudioContext` with `state === 'suspended'`; calling `window.__resumeAudioContext()` invokes `resume()` exactly once.
- A test creates a mock `AudioContext` with `state === 'running'`; calling `window.__resumeAudioContext()` does **not** invoke `resume()`.
- A test verifies that `playSound('card')` with a suspended mock context does not throw (i.e., the resume + play path is safe).
- All existing tests continue to pass.

## Technical Specs

- **File:** `game/client/test/main.test.js`
- Add a new `describe('resumeAudioContext', ...)` block (or integrate into the existing `playSound() and mute toggle` describe block).
- Mock `window.AudioContext` to return a synthetic object with a spy on `resume()` and a configurable `state` property.
- Use `window.__resumeAudioContext()` (already exposed on line 2129 of `main.js`) to invoke the function under test.
- For the `playSound` test, temporarily set `audioCtx` via the same mock and verify no exception is thrown.

## Verification: code
