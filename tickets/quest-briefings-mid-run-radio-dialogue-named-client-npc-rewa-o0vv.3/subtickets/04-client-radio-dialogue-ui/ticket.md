# 04 — Client radio dialogue UI and socket handler

Listen for server `questDialogue` events and render them as PSO-style comms: speaker name + line text, auto-dismiss toast, and append to a small persistent log. Reuse the existing fixed-position toast pattern from `showCardErrorToast` in `main.js`.

## Acceptance Criteria

- `main.js` registers `s.on(SERVER_TO_CLIENT.QUEST_DIALOGUE, …)` and ignores malformed payloads.
- Each event shows a comms toast (speaker bolded or prefixed, body text) that auto-dismisses after ~4s (reuse or generalize `showCardErrorToast`).
- The same line is appended to `#quest-comms-log` (new element) with timestamp or sequential styling; log keeps the last N entries (e.g. 20) without unbounded growth.
- Comms UI is visible during `gamePhase === 'playing'`; hidden or cleared when returning to lobby / new run.
- `window.__showQuestDialogueForTest({ speaker, text })` (or similar) exported for unit tests without a live socket.
- `cd game && pnpm test:quick` passes; tests in `game/client/test/main.test.js` or new `game/client/test/questDialogue.test.js` assert toast + log DOM updates.

## Technical Specs

- **`game/client/main.js`** — Extract `showTransientToast(message, options)` from `showCardErrorToast`; add `handleQuestDialogue(payload)`, socket listener, lobby/run phase visibility hooks, test export.
- **`game/client/index.html`** — Add `#quest-comms-toast` host (optional if toast is body-appended) and `#quest-comms-log` anchored to the HUD (e.g. near objective readout).
- **`game/client/style.css`** — `.quest-comms-toast`, `.quest-comms-log`, `.quest-comms-line` styles (readable over dungeon view, non-blocking).
- **`game/client/test/questDialogue.test.js`** (new, preferred) — Call test hook; assert speaker/text in toast and log list.

## Verification: code
