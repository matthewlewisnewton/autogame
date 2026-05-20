# Ticket: Inventory System Refactor

> [!NOTE]
> **Staleness note.** This ticket was written against commit `70123f1` (2026-05-19). The codebase may have moved on since it was filed — before acting, re-check every file path and code reference below against the CURRENT code, and skip any issue that is already resolved.

## Goal
Refactor the player's card storage from a simple frequency map to a robust inventory system that supports unique properties (like level, grind, and elements) for each card instance.

## Problem
Currently, `ownedCards` is a simple object `{ iron_sword: 3 }`. This makes it impossible to have one `iron_sword` at level 2 and another at level 5. To support the upgrade system, each card must be an independent entity.

## Proposed Changes
- **Server-Side State**: Change `player.ownedCards` to `player.inventory` (an array of objects).
- **Card Instance Object**: Each entry should look like: `{ instanceId: 'uuid', cardId: 'iron_sword', grind: 0, level: 1 }`.
- **Deck Update**: Update the `deckAddCard` and `deckRemoveCard` handlers to use `instanceId` instead of `cardId`.
- **Client Sync**: Ensure `stateSnapshot` and the client-side `renderDeckEditor` can handle the new array-based inventory.

## Verification Plan
1. Connect to the server and verify that the starting inventory is correctly converted to the new format.
2. Add a specific card instance to a deck and verify that other instances of the same `cardId` remain in the inventory.
