# Fix `pickedUpLootIds` doc comment

The declaration comment for `pickedUpLootIds` says the Set is "cleared on each stateUpdate", but the `stateUpdate` handler actually prunes individual IDs that no longer appear in `state.loot` — it never calls `.clear()`. Update the comment to match the real behavior.

## Acceptance Criteria
- The comment above the `pickedUpLootIds` declaration in `game/client/main.js` accurately describes the per-ID pruning behavior (not "cleared").
- No code logic is changed — only the comment text.

## Technical Specs
- **File:** `game/client/main.js` — line ~662
- Change the comment from `"cleared on each stateUpdate"` to something like `"pruned on each stateUpdate to drop IDs no longer present in state.loot"`.

## Verification: code
