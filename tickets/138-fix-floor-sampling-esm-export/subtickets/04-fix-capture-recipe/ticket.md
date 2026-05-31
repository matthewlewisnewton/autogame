# Fix harness capture recipe: add lobby create/join before readyAll

The `fallbackRecipe()` in `harness/screenshot.mjs` calls `readyAll` immediately after login, but the game now requires players to create and join a lobby channel before the squad UI (with `#ready-btn`) appears. The capture times out at `waitForGame` because `readyAll` finds no `#ready-btn` on the Lobby Registry screen, so no one ever deploys and `phase === 'playing'` is never reached.

Add `createLobby` and `joinLobby` actions to the allowlist and update `fallbackRecipe()` to thread: login → create lobby → join lobby → readyAll → waitForGame.

## Acceptance Criteria

- `harness/screenshot.mjs` allowlisted `ACTIONS` set includes `createLobby` and `joinLobby`.
- `createLobby` action implementation:
  - Fills `#create-lobby-name` with a lobby name (default `"Test"`), clicks `#create-lobby-btn`.
  - Waits for `#lobby` container to become visible (no `.hidden` class), confirming the creator entered the squad UI.
  - Accepts optional `name` parameter (alphanumeric + spaces, 1–40 chars); defaults to `"Test"`.
- `joinLobby` action implementation:
  - Clicks the first `.join-lobby-btn` button visible on the lobby browser list (`#lobby-list`).
  - Waits for `#lobby` container to become visible (no `.hidden` class), confirming the joiner entered the squad UI.
  - If no join button is found, logs a warning and continues (does not throw).
- `fallbackRecipe()` is updated to insert lobby flow between login and readyAll:
  - After player A logs in → `createLobby` (player A)
  - After player B logs in → `joinLobby` (player B)
  - Wait for both players in squad → `readyAll` → `waitForGame`
- A full capture run with the updated `fallbackRecipe()` produces `metrics.json` with `"ok": true` and at least one probe showing `harnessState.phase === 'playing'`.
- No game code files under `game/` are modified — this is a harness-only change.

## Technical Specs

- **File**: `harness/screenshot.mjs`
- **Changes**:
  1. Add `'createLobby'` and `'joinLobby'` to the `ACTIONS` Set (line ~46).
  2. Add validation in `validateRecipe` for `createLobby` (accepts `name` string, 1–40 chars, alphanumeric/spaces) and `joinLobby` (no extra params).
  3. Add execution handlers in `executeRecipe` for both actions:
     - `createLobby`: fill `#create-lobby-name`, click `#create-lobby-btn`, wait for `#lobby:not(.hidden)`
     - `joinLobby`: click first `.join-lobby-btn`, wait for `#lobby:not(.hidden)`
  4. Update `fallbackRecipe()` steps to:
     ```
     connectPlayer A → wait → registerUser A → loginUser A → wait
     createLobby A (name: "Test")
     wait
     connectPlayer B → wait → registerUser B → loginUser B → wait
     joinLobby B
     wait
     screenshot "01-initial" (both players in squad)
     readyAll
     waitForGame A (timeoutMs: 12000)
     probe A
     move A (w, 1500ms)
     screenshot "02-after-w"
     move A (d, 1500ms)
     screenshot "03-after-d"
     ```
- **Key DOM selectors** (from `game/client/main.js`):
  - Lobby browser: `#lobby-browser`
  - Create input: `#create-lobby-name`, button: `#create-lobby-btn`
  - Join button: `.join-lobby-btn` (first match in `#lobby-list`)
  - Squad UI: `#lobby` (visible when `.hidden` class is removed)
  - Ready button: `#ready-btn`

## Verification: code
