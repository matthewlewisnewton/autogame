# Ticket: Deck Depletion Fail Condition

## Goal
Implement a graceful failure or "Struggle" mechanic when a player runs out of cards.

## Problem
Currently, if a player's 30-card deck is exhausted and they have no cards left in hand, they cannot perform any actions. If enemies are still alive, the run cannot be completed, leading to a "soft lock" where the player is stuck in the dungeon.

## Proposed Changes
- **Detection**: Check if a player's `hand` is empty and their `deck` is empty.
- **Fail Condition**: If all players in the squad are out of cards and the objective is not met, trigger a "Mission Failed" state.
- **Alternative (Struggle)**: Alternatively, provide a very weak, high-cooldown "Struggle" attack that is always available but inefficient, allowing for a slow completion.

## Verification Plan
1. Exhaust a small test deck during a run.
2. Verify that the game transitions to a failure state or provides a fallback action.
