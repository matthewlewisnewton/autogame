# Quest comms toast anchored above comms log

At level entry, `renderQuestDialoguePayload` shows a `.quest-comms-toast` and appends the same line to `#quest-comms-log`. The toast currently inherits `TRANSIENT_TOAST_BASE_STYLE` center-top placement (`top: 20px; left: 50%`), which can overlap the top-right comms column. Anchor the quest comms toast into the HUD stack so it appears above the log without obscuring log text.

## Acceptance Criteria

- `.quest-comms-toast` renders in the top-right HUD column (aligned with `#top-right-hud-stack`), not centered at the top of the viewport.
- When a run-start quest dialogue fires (`handleQuestDialogue` / `renderQuestDialoguePayload`), the toast and the newly appended `.quest-comms-line` bounding boxes do not intersect at 1280×800.
- Toast still auto-dismisses after `QUEST_COMMS_TOAST_MS` (~4s) with the existing fade-out behavior.
- Other `showTransientToast` callers (e.g. `showCardErrorToast`) keep center-top placement — only quest comms toasts change anchor.
- Existing `questDialogue.test.js` expectations for toast content, log append, and dismiss timing remain satisfied (update tests only if DOM mount point changes).

## Technical Specs

- **`game/client/main.js`** — Update `showQuestCommsToast` (and/or add a quest-comms-specific branch in `showTransientToast`) to mount the toast inside `#top-right-hud-stack` immediately above `#quest-comms-log`, **or** apply a top-right fixed position derived from the stack/log offset instead of `TRANSIENT_TOAST_BASE_STYLE`'s center-top defaults.
- **`game/client/style.css`** — Add `.quest-comms-toast` positioning rules that cooperate with the stack (e.g. `position: relative` when appended in-stack, or a `.quest-comms-toast` override block with `left: auto; right: 0; transform: none; top: auto` when fixed). Preserve existing background, border, and typography.
- **`game/client/test/questDialogue.test.js`** — Adjust assertions if the toast parent/position changes; keep coverage for show, append, and auto-dismiss.
- Do **not** alter dialogue payload validation, log cap (`QUEST_COMMS_LOG_MAX`), or phase gating.

## Verification: code
