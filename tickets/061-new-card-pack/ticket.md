# Ticket: New Card Pack (10 Cards)

> [!NOTE]
> **Staleness note.** This ticket was written against commit `70123f1` (2026-05-19). The codebase may have moved on since it was filed — before acting, re-check every file path and code reference below against the CURRENT code, and skip any issue that is already resolved.

## Difficulty: medium

## Goal
Implement 10 new cards to expand the variety of gameplay.

## Problem
The current card pool is small (4 cards). New types and effects are needed to make the deck-building aspect more meaningful.

## Card List
1.  **Saber of Light** (Weapon): Fast speed, low damage.
2.  **Photon Slicer** (Weapon): Returning projectile.
3.  **Frost Nova** (Summon): Freezes enemies.
4.  **Healing Font** (Summon): Restores HP.
5.  **Skeleton Knight** (Monster): High-aggro tank.
6.  **Storm Eagle** (Monster): Ranged flying minion.
7.  **Gravity Well** (Summon): Pulls enemies to center.
8.  **Echo Blade** (Weapon): Shockwave on 3rd hit.
9.  **Mana Leach** (Summon): Restores MS on hit.
10. **Dragon's Breath** (Summon): Cone fire DoT.

## Proposed Changes
- **CARD_DEFS**: Add definitions for all 10 cards in `game/client/cards.js` and `game/server/index.js`.
- **Logic**: Implement specific logic for new effects (freeze, pull, heal, mana leach).
- **Visuals**: Add new icons and colors to `CARD_TYPE_STYLE`.

## Verification Plan
1. Add the new cards to the starting deck and verify each effect works as described during a run.
