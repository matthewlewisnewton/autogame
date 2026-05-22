# Use Role-Based Client Spawn Lookup

`buildDungeon()` in `game/client/dungeon.js` derives `spawnPosition` from the first room in the layout array. The server contract now designates a `start` room via role — use that directly so the client stays aligned if start-room selection changes in the future.

## Acceptance Criteria
- `buildDungeon()` derives `spawnPosition` from the room with `role === 'start'`.
- If no room has a `start` role, it falls back to the first room (or `{ x: 0, z: 0 }` if the layout is empty).
- The comment above the spawn-position logic refers to the **start room role** rather than "first room".

## Technical Specs
- **File**: `game/client/dungeon.js` — change the spawn-position computation inside `buildDungeon()`. Replace the `layout.rooms[0]` lookup with a `.find(r => r.role === 'start')` + fallback.
- Update the nearby code comment to mention the start room role.

## Verification: code
