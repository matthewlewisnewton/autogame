# Unlock quest selection UI when a suspended run exists

## Description

The client locks quest selection when `suspendedRunSummary` is set:
- Contract Terminal: `selectionLocked: !!suspendedRunSummary` (line ~1816 of `main.js`)
- Level Map: same guard blocks `SELECT_QUEST` emit (line ~1844)
- Both show `THEME.run.questSuspendedLocked` error when clicking a quest

After sub-ticket 01, the server accepts quest changes (clearing the checkpoint). The client needs to stop blocking quest selection and instead allow the emit. When the server processes a different-quest selection, it will clear the checkpoint and send back `STATE_UPDATE` with `suspendedRunSummary: null` — the client already handles clearing the banner on that.

## Acceptance Criteria

- When `suspendedRunSummary` is set, clicking a quest on the Contract Terminal emits `SELECT_QUEST` (does NOT show locked error)
- When `suspendedRunSummary` is set, clicking a node on the Level Map emits `SELECT_QUEST` (does NOT show locked error)
- `selectionLocked` passed to the quest board is `false` even when `suspendedRunSummary` is set
- After server accepts a different-quest selection and sends `STATE_UPDATE` with `suspendedRunSummary: null`, the suspended run banner is cleared (existing behavior, should still work)
- Existing tests for suspended-run UI continue to pass

## Technical Specs

- **File:** `game/client/main.js` — remove the `suspendedRunSummary` guard in the quest board's `onSelect` callback (~line 1806–1809) and the level map's `onSelectNode` (~line 1844–1847). Change `selectionLocked: !!suspendedRunSummary` to `selectionLocked: false` (or remove the suspended-run condition from the lock expression).
- **File:** `game/client/test/main.test.js` — update or add tests: verify that clicking a quest when `suspendedRunSummary` is set still emits `SELECT_QUEST` socket event. Verify the suspended banner is cleared after `STATE_UPDATE` with `suspendedRunSummary: null`.

## Verification: code
