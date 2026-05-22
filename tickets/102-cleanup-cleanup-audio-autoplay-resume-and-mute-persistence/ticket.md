# Cleanup nits from 046-cleanup-audio-autoplay-resume-and-mute-persistence

> **Staleness note.** This follow-up ticket was written against commit
> `1c005de` (2026-05-22). The codebase may have moved on since it was filed —
> before acting, re-check every file path and code reference below
> against the CURRENT code, and skip any nit that is already resolved.

Minor, non-blocking nits the reviewer noted while passing `046-cleanup-audio-autoplay-resume-and-mute-persistence`.
None blocked acceptance — clean them up when convenient.

## Difficulty: easy

## Unit tests for AudioContext resume helper

`resumeAudioContext()` and its call from `playSound()` are only verified by code inspection. A small jsdom test with a mock `AudioContext` (`state: 'suspended'`, spy on `resume()`) would lock in the guard and ensure future refactors do not drop the resume call.
### Acceptance Criteria
- Mock context with `state === 'suspended'`; calling `window.__resumeAudioContext()` invokes `resume()` once.
- Mock context with `state === 'running'`; `resume()` is not called.
- `playSound('card')` with a suspended mock context does not throw.

## Cold-start mute icon integration test

Mute persistence tests call `__loadSoundEnabled()` after `import('../main.js')`, which does not re-run `let soundEnabled = loadSoundEnabled()` because Vitest caches the module. A `vi.resetModules()` test that pre-seeds `localStorage` before the first import would prove startup wiring end-to-end.
### Acceptance Criteria
- With `localStorage.setItem('autogame:soundEnabled', 'false')` set before first import, `window.__soundEnabled()` is `false` and `#mute-btn` text is `🔇` without any click.
