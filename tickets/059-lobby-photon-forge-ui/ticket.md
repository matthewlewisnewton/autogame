# Ticket: Lobby Photon Forge UI

> [!NOTE]
> **Staleness note.** This ticket was written against commit `70123f1` (2026-05-19). The codebase may have moved on since it was filed — before acting, re-check every file path and code reference below against the CURRENT code, and skip any issue that is already resolved.

## Difficulty: medium

## Goal
Implement a new "Photon Forge" tab in the lobby UI where players can manage card upgrades.

## Problem
There is currently no UI for spending currency to upgrade cards. The lobby only supports deck editing.

## Proposed Changes
- **Lobby Tabs**: Add a "Photon Forge" tab alongside "Deck Editor".
- **Card Selection**: Display the player's inventory in a grid.
- **Upgrade Preview**: When a card is selected, show its current stats vs. its upgraded stats.
- **Cost Display**: Show the GOLD cost required for the next upgrade level.
- **Upgrade Animation**: Add a simple CSS/JS visual effect when an upgrade is successful.

## Verification Plan
1. Open the lobby and switch to the Photon Forge tab.
2. Select a card and verify that the "Upgrade" button is disabled if the player has insufficient GOLD.
