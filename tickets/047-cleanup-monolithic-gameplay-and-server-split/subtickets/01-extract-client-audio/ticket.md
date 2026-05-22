# Extract Client Audio Module

Move the oscillator-based Web Audio synthesizer system out of `game/client/main.js` into a dedicated `game/client/audio.js` module.

## Acceptance Criteria

- `game/client/audio.js` exists and exports:
  - `playSound(type)` — creates oscillators from `SOUND_CONFIG[type]`; supports single-note and multi-note (victory/failure) sounds; no-ops when muted
  - `isSoundEnabled()` / `setSoundEnabled(value)` — getters/setters that persist to `localStorage`
  - `resumeAudioContext()` — resumes a suspended AudioContext (autoplay policy)
  - `getAudioContext()` — returns the lazy-created AudioContext (for test injection)
  - `_soundLogEnabled` and `_playSoundCallLog` — test-only tracking
- `game/client/audio.js` sets up document-level `click` and `keydown` listeners for autoplay resume
- `game/client/main.js` imports `playSound`, `isSoundEnabled`, `setSoundEnabled`, `resumeAudioContext` from `./audio.js` instead of defining them inline
- The mute toggle in `main.js` uses `isSoundEnabled()` / `setSoundEnabled()` from the audio module
- All existing client unit tests pass (`npm test` in `game/client/`)
- Audio behavior is unchanged: sounds play on card use, enemy hit, player damage, loot pickup, victory, and failure

## Technical Specs

- **New file:** `game/client/audio.js` — ES module with all audio logic currently at lines ~498-610 of `main.js`
- **Modify:** `game/client/main.js` — remove inline audio code; import from `./audio.js`; replace all calls to inline `playSound()` with the imported version; replace `soundEnabled` reads/writes with `isSoundEnabled()`/`setSoundEnabled()`
- **Dependency:** `SOUND_CONFIG` from `./config.js` (already imported by `main.js`; move import to `audio.js`)
- **No changes** to `game/client/config.js`, `index.html`, or `style.css`

## Verification: code
