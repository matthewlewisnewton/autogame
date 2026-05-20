# Ticket: Server-Side Wall Collision Validation

> [!NOTE]
> **Staleness note.** This ticket was written against commit `70123f1` (2026-05-19). The codebase may have moved on since it was filed — before acting, re-check every file path and code reference below against the CURRENT code, and skip any issue that is already resolved.

## Difficulty: easy

## Goal
Implement validation on the server to ensure players cannot walk through walls.

## Problem
Currently, the server's `clampToDungeon` function only checks the overall bounding box of the entire dungeon. It does not check if a player's `(x, z)` position is actually inside a room or a passage. This allows hacked clients to bypass wall collision and walk through the "void" between rooms.

## Proposed Changes
- **Dungeon Data**: Ensure the server has access to the full list of room and passage AABBs.
- **Validation Logic**: Implement an `isInsideDungeon(x, z)` function that returns true only if the point is within at least one room or passage.
- **Movement Clamp**: Update the `move` handler to reject or clamp positions that are not inside the valid dungeon area.

## Verification Plan
1. Modify a local client to skip `resolveWallCollision` and try walking through a wall.
2. Verify that the server snaps the player back or rejects the move.
