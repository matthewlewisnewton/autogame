# Client Room Role Visuals

Render subtle visual differences per room role on the client so players can distinguish start, combat, and treasure rooms in the dungeon.

## Acceptance Criteria
- Start rooms have a distinct floor tint (e.g., slightly greenish).
- Combat rooms have the default floor color (no change from current appearance).
- Treasure rooms have a distinct floor tint (e.g., slightly golden/yellow) AND a small marker prop (e.g., a glowing sphere or pillar) at the room center.
- The visual differences are subtle — not overwhelming the existing dungeon aesthetic.
- All existing wall and passage rendering remains unchanged.
- Room role rendering works for any layout the server sends (handles layouts with or without role metadata gracefully).

## Technical Specs
- **File:** `game/client/dungeon.js`
  - Add role-to-color mapping: `start` → subtle green tint (e.g., `0x3a5a3a`), `combat` → existing default, `treasure` → subtle gold tint (e.g., `0x5a5a2a`).
  - In `buildDungeon()`, check `room.role` on each room; create a separate `MeshStandardMaterial` with the role-specific color for the room's floor.
  - For treasure rooms, add a small marker prop at the room center — e.g., a `CylinderGeometry(0.3, 0.3, 1.5, 8)` with emissive gold material, positioned at `{x: room.x, z: room.z, y: 0.75}`.
  - If `room.role` is undefined, use the existing default floor material (graceful fallback).
  - Add shared materials for role-specific floors to avoid per-room material allocation.
- **File:** `game/client/main.js` — no changes needed; `buildDungeon` already receives the full layout with role metadata.

## Verification: visual
