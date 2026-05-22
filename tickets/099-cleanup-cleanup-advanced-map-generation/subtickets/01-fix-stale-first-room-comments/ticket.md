# Fix stale "first room" comments in main.js

`buildDungeon()` now selects a spawn position from the room with `role === 'start'`, but two comments in `game/client/main.js` still refer to the "first room". Update them to mention the start room role.

## Acceptance Criteria
- The comment on line ~574 (`spawnPosition` declaration) references the **start room** (or "spawn from layout") instead of "first room".
- The comment on line ~2020 (post-`buildDungeon()` placement) references the **start room** (or "spawn from layout") instead of "first room".
- No other comments or logic are modified.

## Technical Specs
- **File**: `game/client/main.js`
  - Line 574: change `// center of first room, set by buildDungeon` → `// center of start room (role='start'), set by buildDungeon`
  - Line ~2020: change `// Place player at spawn position (center of first room)` → `// Place player at spawn position (center of start room)`

## Verification: code
