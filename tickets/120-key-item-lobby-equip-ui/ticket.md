# Key Item Lobby Equip UI

Let players **choose their equipped key item in the lobby** before deploying.

## Difficulty: medium

## Goal

Add a lobby UI panel (tab or section beside Loadout Bay) listing all unlocked key
items, showing the equipped selection and cooldown rules in copy text.

## Problem

Ticket 118 stores `equippedKeyItemId` but players have no in-game way to change it
without a debug socket emit.

## Acceptance Criteria

- Lobby UI lists every unlocked key item from `KEY_ITEM_DEFS` (all 14 ids from
  ticket 118; layout supports scrolling if needed).
- Selected item is visually highlighted; clicking another item calls
  `equipKeyItem` and updates on success.
- Selection persists across lobby ↔ auth refresh (server is source of truth on
  reconnect).
- Shows item name, short description, and base cooldown (read from defs).
- Empty/error states handled (socket disconnected, equip rejected).
- Does not appear inside active dungeon HUD as a full editor — equip only in lobby.
- Tests: DOM renders list when lobby open; selecting item triggers equip emit
  (mock socket) or pure helper tests for selection state.
- Accessible labels and keyboard focus for the equip list.

## Implementation Notes

- Depends on **118-key-item-data-and-persistence**.
- Can land before **119** (equip without rebind) but should be after 118; order in
  `TASKS.md` keeps UI after bindings for parallel harness work — either order OK.
- Follow `deck-editor` / `lobby-tab-*` patterns in `game/client/index.html` and
  `main.js`.
- Key files: `game/client/index.html`, `game/client/main.js`, optional small module
  `game/client/key-item-loadout.js`.

## Verification

- `Verification: visual` — screenshot of lobby with dodge_roll selected.
- `Verification: code` — unit tests for list/selection helpers.

## Dependencies

- [118-key-item-data-and-persistence](tickets/118-key-item-data-and-persistence/)
