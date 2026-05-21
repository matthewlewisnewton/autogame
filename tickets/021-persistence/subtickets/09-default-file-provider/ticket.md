# Default to FileProvider for durable persistence

Make the file-backed provider the default runtime backend so that a normal `pnpm run dev` run durably persists player data across server restarts, rather than relying on an environment variable override.

## Acceptance Criteria
- Starting the server without `PERSISTENCE_BACKEND` set uses `FileProvider` (not `InMemoryProvider`)
- The console log on startup indicates `FileProvider` is initialized (not `InMemoryProvider`)
- The data directory path defaults to a stable location (e.g., `./data` relative to the server, or `game/data`)
- Tests can still override the provider via `setTestProvider()` without being affected by the default change
- `InMemoryProvider` remains available for explicit opt-in via `PERSISTENCE_BACKEND=memory`

## Technical Specs
- **File**: `game/server/index.js` — In `startServer()`, swap the conditional so `FileProvider` is the default branch and `InMemoryProvider` is the opt-in fallback when `PERSISTENCE_BACKEND=memory`
- **File**: `game/server/providers.js` — no changes needed (providers already exist)
- **File**: `game/.gitignore` (or server-side equivalent) — ensure the data directory is git-ignored so player save files aren't committed

## Verification: code
