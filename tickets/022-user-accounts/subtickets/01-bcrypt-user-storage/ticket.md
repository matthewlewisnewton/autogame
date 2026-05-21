# bcrypt User Storage Layer

Add `bcrypt` to the server dependencies and create a `users.js` module that wraps password hashing, user creation, and credential verification. This is the pure-data foundation that all later auth sub-tickets depend on.

## Acceptance Criteria
- `bcrypt` is listed as a dependency in `game/server/package.json` and installed.
- `game/server/users.js` exports:
  - `hashPassword(plainPassword)` — returns a bcrypt hash string.
  - `comparePassword(plainPassword, hash)` — returns a boolean.
  - `createUser(username, plainPassword)` — stores a user record; returns `{ ok: true }` or `{ ok: false, reason: '...' }` (rejects duplicate usernames).
  - `findUserByUsername(username)` — returns the user record object or `null`.
- User records are stored in an in-memory `Map` (keyed by username) so no external database is required.
- Each user record contains: `username`, `passwordHash`, and `accountId` (a UUID generated on creation).
- Unit tests exist for `hashPassword`, `comparePassword`, `createUser` (happy path + duplicate), and `findUserByUsername` (found + not found); all pass.

## Technical Specs
- **New file**: `game/server/users.js` — module with a `const users = new Map()` store and the four exported functions above.
- **Modify**: `game/server/package.json` — add `"bcrypt": "^5.1.1"` to dependencies.
- Use `bcrypt.hash(plain, 10)` and `bcrypt.compare(plain, hash)` from the `bcrypt` package.
- Use `crypto.randomUUID()` (already available in Node.js) for `accountId`.

## Verification: code
