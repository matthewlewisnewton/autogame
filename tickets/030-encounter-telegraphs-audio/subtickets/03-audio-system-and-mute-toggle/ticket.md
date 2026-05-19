# Audio System and Mute Toggle

Add a lightweight Web Audio API helper and a mute toggle UI so the game can play generated sound effects without external assets or throwing errors.

## Acceptance Criteria
- A `playSound(type)` helper exists in `game/client/main.js` that uses the Web Audio API (`AudioContext`) to generate short oscillator-based beeps.
- `playSound()` accepts a `type` string parameter (e.g., `'card'`, `'enemyHit'`, `'playerDamage'`, `'loot'`, `'victory'`, `'failure'`) and plays a distinct tone per type (different frequency or duration).
- A single `soundEnabled` boolean variable controls whether sounds play; when `false`, `playSound()` is a no-op.
- `playSound()` never throws — if `AudioContext` is unavailable or playback is blocked by the browser, it catches the error silently and continues.
- A mute toggle button is added to the HTML (`#mute-btn`) and styled in CSS.
- Clicking the mute button toggles `soundEnabled` and updates the button text/icon between "🔊" (unmuted) and "🔇" (muted).
- Audio is enabled by default on first load.

## Technical Specs
- **File:** `game/client/main.js`
  - Add `let soundEnabled = true;` near the top-level state variables.
  - Add `let audioCtx = null;` — lazily initialized on first `playSound()` call with `new (window.AudioContext || window.webkitAudioContext)()`.
  - Implement `function playSound(type)` that:
    - Returns immediately if `!soundEnabled`.
    - Lazily creates `audioCtx` if null.
    - Creates an `OscillatorNode`, sets frequency/duration based on `type`:
      - `'card'` → 600 Hz, 100 ms
      - `'enemyHit'` → 300 Hz, 150 ms
      - `'playerDamage'` → 200 Hz, 200 ms
      - `'loot'` → 800 Hz, 80 ms
      - `'victory'` → 500 Hz → 700 Hz (two notes, 150 ms each)
      - `'failure'` → 400 Hz → 250 Hz (two notes, 200 ms each)
    - Connects oscillator to `audioCtx.destination`, calls `start()` and `stop(audioCtx.currentTime + duration)`.
    - Wraps the entire body in `try { ... } catch(e) { /* silent */ }`.
  - Add a click listener on `document.getElementById('mute-btn')` that toggles `soundEnabled` and updates button text.
- **File:** `game/client/index.html`
  - Add `<button id="mute-btn">🔊</button>` inside the `#ui` div, near the status display.
- **File:** `game/client/style.css`
  - Add `#mute-btn` styling: minimal button, positioned near top-right or inline with status, matching the existing UI aesthetic.

## Verification: code
