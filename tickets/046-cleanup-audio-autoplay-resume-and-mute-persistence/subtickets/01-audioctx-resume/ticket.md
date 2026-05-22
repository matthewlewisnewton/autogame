# AudioContext Resume on User Interaction

The `AudioContext` is lazily created in `playSound()` without a user gesture, which can leave it in a `'suspended'` state under modern browser autoplay policies. Add a resume mechanism so audio works after the first interaction.

## Acceptance Criteria

- A `resumeAudioContext()` helper exists that calls `audioCtx.resume()` when `audioCtx.state === 'suspended'`, wrapped in a try/catch so it never throws.
- `resumeAudioContext()` is called on the first `click` and `keydown` events (registered once at module load time).
- Calling `playSound()` on a suspended context does not throw — either the resume fires first, or the existing catch block swallows the error.
- Existing tests continue to pass; no new test required (behavior is browser-environment dependent and verifiable via code inspection).

## Technical Specs

- **File:** `game/client/main.js`
- Add `resumeAudioContext()` function near the existing `playSound()` / `audioCtx` declarations (~line 508).
- Attach one-time listeners for `click` and `keydown` on `document` that invoke `resumeAudioContext()`.
- The function should be exposed on `window` for test access: `window.__resumeAudioContext = resumeAudioContext;`

## Verification: code
