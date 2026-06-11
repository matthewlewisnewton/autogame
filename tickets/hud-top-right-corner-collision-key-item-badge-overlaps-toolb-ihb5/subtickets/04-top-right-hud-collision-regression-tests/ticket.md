# Top-right HUD collision regression tests

Add automated layout coverage so the parent ticket acceptance criteria cannot regress: no top-right HUD overlap at standard viewports when the key item is equipped, lock-on is active, and quest comms are showing.

## Acceptance Criteria

- New vitest coverage asserts pairwise non-overlap (or equivalent layout invariants) for `#app-toolbar` buttons, visible `#key-item-indicator`, visible `#lock-on-info-panel`, `#quest-comms-log` with lines, and `.quest-comms-toast` at **1280×800** and **1920×1080**.
- Tests cover the three repro scenarios from the parent ticket:
  1. In-run with default `dodge_roll` equipped — toolbar buttons vs key-item badge.
  2. Lock-on active with comms log populated — lock-on panel vs comms log.
  3. Level-entry quest dialogue — comms toast vs comms log line.
- `pnpm test:quick` (client suite) passes with the new tests.
- Tests fail on the pre-fix layout (absolute `top: 36px` / `44px` / `92px` collisions) if reverted.

## Technical Specs

- **Add** `game/client/test/top-right-hud-layout.test.js`:
  - Load `index.html` + `style.css` via `JSDOM` (mirror `settings-layout.test.js` pattern).
  - Helper `rectsOverlap(a, b)` using `getBoundingClientRect()` (set `window.innerWidth` / `innerHeight` per viewport case).
  - Scenarios: show `#app-toolbar`, populate key-item indicator (`.ready` + `data-key-item-id="dodge_roll"`), unhide lock-on panel with representative content height, append comms log lines, trigger quest comms toast via `window.__showQuestDialogueForTest` after importing `main.js`.
- **`game/client/test/questDialogue.test.js`** — Only touch if needed to share overlap helpers; prefer keeping overlap matrix in the new file.
- No production CSS/HTML changes unless a minimal `data-testid` or layout hook is strictly required for measurement (prefer measuring real element IDs).

## Verification: code
