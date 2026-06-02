# Spire Ascent — playable quest entry

Register a normal quest that deploys the spire-ascent layout through the existing quest/layout pipeline so lobbies can select it like `canyon_descent`.

## Acceptance Criteria

- `QUEST_DEFS` includes a `spire_ascent` (or similarly named) quest with `layoutProfile: 'spire-ascent'`, defeat- or collect-style objective, and enemy/item counts consistent with multi-tier pacing.
- `getLayoutProfileForQuest('spire_ascent')` returns `'spire-ascent'`.
- `applyLayoutForQuest` / deploy flow produces `gameState.layout.profile === 'spire-ascent'` when that quest is selected.
- Integration or server test confirms selecting the quest and entering the playing phase uses the spire layout (not default crowded grid).

## Technical Specs

- **`game/server/quests.js`** — add quest definition with `layoutProfile: 'spire-ascent'`.
- **`game/server/test/`** — extend an existing quest/layout test or add a focused test that sets `selectedQuestId` to the new quest, calls `applyLayoutForQuest`, and asserts profile and tier room count.

## Verification: code
