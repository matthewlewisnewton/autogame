# Ticket: Server-Side Card Hand Tracking

> [!NOTE]
> **Staleness note.** This ticket was written against commit `70123f1` (2026-05-19). The codebase may have moved on since it was filed — before acting, re-check every file path and code reference below against the CURRENT code, and skip any issue that is already resolved.

## Difficulty: medium

## Goal
Implement server-side tracking of each player's card hand to prevent unauthorized card usage.

## Problem
The server currently does not know which cards are in a player's hand. When a client emits `useCard`, the server only validates that the `cardId` exists globally. A client could use any card at any time, or use the same card multiple times without depleting it.

## Proposed Changes
- **Player State**: Add a `hand` array to the player object in `gameState.players`.
- **Initialization**: Populate the `hand` array on the server when the game starts (shuffling the `selectedDeck` and drawing the first 4).
- **Validation**: In the `useCard` handler, verify that the requested `cardId` is actually at the specified `slotIndex` in the server's version of the player's hand.
- **Consumption**: Decrement charges and redraw new cards on the server side, then broadcast the update.

## Verification Plan
1. Attempt to use a card ID that is not in the player's starting deck via a socket emit.
2. Verify the server rejects the action with a `cardError`.
