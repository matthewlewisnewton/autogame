# Durable User Account Records

Persist user account records (username, password hash, accountId) to disk so that accounts survive server restarts. Load existing accounts on startup so players can log back into the same `accountId` and access their saved character data.

## Acceptance Criteria
- User records are persisted to a JSON file (e.g. `data/users.json`) using an atomic write pattern (write to temp file, then rename).
- On server startup, `users.js` loads existing user records from disk into the in-memory `Map`.
- After server restart, a player can log in with the same username/password and receive the same `accountId` as before.
- `createUser()` writes the new record to disk immediately after adding it to the in-memory map.
- The file path is configurable via `USERS_FILE` env var (default: `data/users.json` under the server directory).
- If the file doesn't exist on startup (first run), the module starts with an empty user map.
- Unit tests cover: save on create, load on startup, accountId stability across "restarts" (clear map, reload from file), and missing file handling.

## Technical Specs
- **Modify**: `game/server/users.js` —
  - Add `const fs = require('fs'); const path = require('path');`
  - Add `const USERS_FILE = process.env.USERS_FILE || path.join(__dirname, '..', 'data', 'users.json');`
  - Add `loadUsers()` — reads and parses the JSON file, populates the `users` Map; catches file-not-found silently.
  - Add `saveUsers()` — serializes the Map to JSON and writes atomically (write to `.tmp` + `rename`).
  - Call `saveUsers()` after every `createUser()` success.
  - Call `loadUsers()` at module initialization time (top-level or in an exported init function called by `index.js`).
  - Export `getUsersFilePath()` for test cleanup.
- **Modify**: `game/server/index.js` — ensure the `data/` directory exists before starting (create with `fs.mkdirSync` if needed).
- **Modify**: `game/server/test/users.test.js` — add tests for file-backed persistence: write user, verify file contents, clear map, reload, verify accountId is the same. Use a temp file path via `USERS_FILE` env var.

## Verification: code
