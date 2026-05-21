# Fix harness capture to press the monster card slot

The harness capture for ticket 094 exercised slot 1 (`battle_familiar` summon) instead of the hand slot whose card `type === 'monster'`. Update the capture/probe so it correctly presses the monster slot and verifies minion spawn + slot replacement.

## Acceptance Criteria
- The harness capture script (or QA probe) emits `useCard` / `cardPress` targeting the hand slot whose `type === 'monster'`.
- A post-capture probe verifies `gameState.minions.length` increased after the press.
- A post-capture probe verifies the monster hand slot was replaced via `stateUpdate` (slot is now empty or refilled by redraw).

## Technical Specs
- **Files to change:** `harness/` — locate the capture plan or probe script used for ticket 094's screenshot pass (likely a `.js` or `.json` file referencing `cardPress` or `useCard` with a slot index).
- Determine which hand slot index holds the monster card (may require reading the deck setup or querying `gameState.hand` for `type === 'monster'`).
- Change the `cardPress` / `useCard` to target that slot index instead of slot 1.
- Add post-capture assertions for `gameState.minions.length` and slot replacement in `stateUpdate`.

## Verification: code
