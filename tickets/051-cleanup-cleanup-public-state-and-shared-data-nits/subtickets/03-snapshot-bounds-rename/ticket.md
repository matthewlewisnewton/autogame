# Document or standardise the `bounds` / `dungeonBounds` rename in snapshot

`game/server/index.js` builds the client snapshot with `bounds: gameState.dungeonBounds`. The server-internal field is `dungeonBounds` but the emitted key is `bounds`. The client doesn't currently read either name, so nothing breaks — but the mismatch could confuse future readers. Either standardise on one name end-to-end (rename the snapshot key to `dungeonBounds`) or add a short comment at the snapshot site explaining the intentional rename.

## Acceptance Criteria
- The snapshot key either matches the server-internal name (`dungeonBounds`), or a comment at the rename site (`bounds: gameState.dungeonBounds`) documents the intentional public-name choice.
- No client functionality is affected (client currently reads neither field).
- All existing tests still pass.

## Technical Specs
- **File**: `game/server/index.js`
  - Line ~896: `bounds: gameState.dungeonBounds` — either rename key to `dungeonBounds` or add a `// public name: bounds` comment.
  - If renaming, verify no other server code references the snapshot key `bounds` (grep for it).

## Verification: code
