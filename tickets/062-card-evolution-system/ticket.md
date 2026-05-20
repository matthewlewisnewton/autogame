# Ticket: Card Evolution System (+10 Transformation)

> [!NOTE]
> **Staleness note.** This ticket was written against commit `70123f1` (2026-05-19). The codebase may have moved on since it was filed — before acting, re-check every file path and code reference below against the CURRENT code, and skip any issue that is already resolved.

## Difficulty: hard

## Goal
Implement the system for evolving +10 cards into more powerful forms.

## Problem
Requires both the Inventory System Refactor and the Grinding System to be complete. Provides a "late-game" goal for players.

## Proposed Changes
- **Evolution Logic**: Implement `evolveCard(instanceId)` handler.
- **Requirement Check**: Verify the card is `grind: 10`.
- **Transformation Table**: Map base cards to their evolved counterparts (e.g., `iron_sword` -> `steel_broadsword`).
- **Special Effects**: Add a `specialEffect` field to the evolved cards (e.g., knockback, bleed, fire trail).
- **Lobby Visuals**: Add a special "Evolved" glow or border to the card icons in the inventory.

## Verification Plan
1. Grind a card to +10.
2. Evolve it and verify that it transforms into the new card type with enhanced stats.
