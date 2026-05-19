# Lobby Quest Board and Mission Selection

Add the first half of a *Phantasy Star Online Episodes I&II*-inspired quest loop:
players should choose a specific mission from the lobby before readying up,
instead of every run launching the same implicit dungeon.

## Source Material Note

`game/docs/design.md` names *Phantasy Star Online Episodes I&II* as reference
material. The most missing PSO-like loop element is the lobby-to-quest structure:
players gather in a hub, choose a quest/mission, then launch into a run with
clear mission text and rewards.

This ticket only adds quest selection. Party-scoped quest launch and run setup
belong to `041-quest-scoped-party-runs`.

## Goal

The lobby should show a small quest board with 2-3 predefined missions. The
server owns the selected quest, validates it, broadcasts it to connected
players, and uses it as metadata for future run creation.

## Quest Data

Add a small quest definition table on the server. Keep it simple:

```js
const QUEST_DEFS = {
  training_caverns: {
    id: 'training_caverns',
    name: 'Training Caverns',
    description: 'Clear a small dungeon of hostile creatures.',
    objectiveType: 'defeat_enemies',
    enemyCount: 5,
    rewardCurrency: 10
  },
  crystal_rescue: {
    id: 'crystal_rescue',
    name: 'Crystal Rescue',
    description: 'Recover lost crystals from a guarded room.',
    objectiveType: 'collect_items',
    itemCount: 3,
    enemyCount: 4,
    rewardCurrency: 12
  }
};
```

If `collect_items` is too much for this ticket, include it as visible metadata
only and keep the actual run objective as `defeat_enemies` until a later quest
objective ticket.

## Acceptance Criteria

- The server has a canonical `QUEST_DEFS` table and a default selected quest.
- Each connected player receives the current selected quest and the list of
  available quests during lobby updates or a new `questUpdate` event.
- The client lobby renders a simple quest board with quest name, description,
  objective summary, and reward summary.
- A player can select a quest from the lobby.
- The server validates selected quest ids and rejects unknown quest ids without
  changing the selected quest.
- The selected quest is visible to every connected player before the run starts.
- Ready-up still works after quest selection.
- Existing lobby/deck editor UI remains usable.

## Implementation Notes

- Start with a single shared selected quest for the current lobby session. Do
  not implement multiple parties or private rooms in this ticket.
- Suggested server event: `selectQuest` with `{ questId }`.
- Suggested server response/broadcast: `questUpdate` with `{ selectedQuestId,
  quests }`.
- Include selected quest data in `lobbyUpdate` if that is simpler than adding a
  new event.
- Keep quest data plain JSON-serializable.
- Keep client rendering text-first; no quest art or map preview required.

## Files

- `game/server/index.js`
- `game/client/index.html`
- `game/client/main.js`
- `game/client/style.css`
- `game/server/test/server.test.js`
- `game/server/test/integration.test.js`
- `game/client/test/main.test.js`

## Tests

- Unit test that the server exposes valid quest definitions with stable ids.
- Integration test that a client can select a valid quest and all clients see
  the updated selected quest.
- Integration test that selecting an unknown quest emits an error or no-op and
  preserves the previous selected quest.
- Client test for rendering quest board state if helper extraction is practical.

## Visual QA Checklist

- Open the lobby and verify a quest board appears.
- Select each available quest and verify the selected quest highlight/text
  updates.
- Connect a second browser and verify both clients see the same selected quest.
- Ready up and verify the existing run launch still works.
