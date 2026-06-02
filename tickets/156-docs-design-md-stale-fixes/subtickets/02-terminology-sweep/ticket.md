# Terminology sweep: replace "squad" with "lobby"

The codebase uses "lobby" as the group concept; there is no "squad" entity. Replace all occurrences of "squad" in `game/docs/design.md` with "lobby" to match actual code terminology.

## Acceptance Criteria

- All instances of "squad" in `game/docs/design.md` are replaced with "lobby" (or "lobby members" where grammatically appropriate).
- Expected occurrences to fix: "join squads", "Once in a squad", "all squad members", "lets a squad suspend", "remaining squadmates", "When the squad Deploys", "returns the squad".
- The single theme string `"awaitingExtract"` in `theme.json` is NOT changed (that's runtime code, not the design doc).

## Technical Specs

- Edit only `game/docs/design.md`.
- Verify against `game/server/lobbies.js` which uses `lobbies`, `createLobby()`, `joinLobby()`, `leaveLobby()` — no "squad" data structures exist.

## Verification: code
