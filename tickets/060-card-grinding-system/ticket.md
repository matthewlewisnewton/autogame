# Ticket: Card Grinding System (+N)

> [!NOTE]
> **Staleness note.** This ticket was written against commit `70123f1` (2026-05-19). The codebase may have moved on since it was filed — before acting, re-check every file path and code reference below against the CURRENT code, and skip any issue that is already resolved.

## Goal
Implement the logic for incrementally upgrading card power via the "Grinding" (+1, +2...) system.

## Problem
Requires the Inventory System Refactor to be complete. Cards need a way to store their grind level and apply it to their combat stats.

## Proposed Changes
- **Grind Logic**: Implement a server-side `grindCard(instanceId)` handler.
- **Cost Scaling**: Cost should increase with each level (e.g., `100 * (level + 1)` GOLD).
- **Stat Scaling**: Add a `getStatMultiplier(grind)` function that returns a multiplier (e.g., `1.0 + (grind * 0.05)`).
- **Combat Integration**: Update the weapon damage, summon damage, and monster HP/TTL logic to apply the multiplier based on the card instance used.

## Verification Plan
1. Upgrade an Iron Sword to +5 in the lobby.
2. Enter a run and verify that the Iron Sword deals more damage than a base +0 sword.
