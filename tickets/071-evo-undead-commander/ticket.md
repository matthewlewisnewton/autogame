# Ticket: Evolution - Undead Commander


**Status:** Complete (merged to main in `0d7d7c5`)

> [!NOTE]
> **Staleness note.** This ticket was written against commit `70123f1` (2026-05-19). The codebase may have moved on since it was filed — before acting, re-check every file path and code reference below against the CURRENT code, and skip any issue that is already resolved.

## Difficulty: easy

## Goal
Implement the evolved form of **Skeleton Knight**: the **Undead Commander**.

## Requirements
- **Stats**: Inherit base stats from Skeleton Knight but apply a significant buff (e.g., +50% damage).
- **Special Effect**: Summons 2 smaller skeletons when played.
- **Visuals**: Define a new icon and color theme for this card.
- **Recipe**: This card is obtained by evolving a `Skeleton Knight +10`.

## Implementation Tasks
- [x] Add `undead_commander` definition to `CARD_DEFS`.
- [x] Implement the unique ability logic in the server-side `useCard` handler.
- [x] Add visual feedback (particles/sound) for the new effect on the client.

## Verification Plan
1. Evolve a Skeleton Knight into a Undead Commander.
2. Verify the special effect triggers correctly during gameplay.
