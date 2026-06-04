# Pass allocated game port to Vite in start_game

Round-1 review capture failed because the game server listened on the allocated port (e.g. 3002) while Vite’s `/api` and `/socket.io` proxy targeted the default 3000 — `HARNESS_GAME_PORT` was not set on the Vite subprocess. Wire `ports.game_server` into the Vite launch env the same way `PORT` is wired for the server, so non-default parallel workers load and proxy correctly.

## Acceptance Criteria

- In `harness/steps/game.py` `start_game`, the Vite `subprocess.Popen` passes an explicit `env` that includes `HARNESS_GAME_PORT` set to `str(ports.game_server)` (merged with `os.environ`, same pattern as the server’s `PORT` env).
- A unit test in `harness/tests/unit/test_game_start.py` asserts the Vite launch’s `env["HARNESS_GAME_PORT"]` equals the allocated `ports.game_server` for a non-default `PortAllocation` (e.g. game 3007 / vite 5180).
- `python -m pytest harness/tests/unit/test_game_start.py` passes.
- **Do not modify** any file under `game/` — the lobby disconnect fix is already complete; this sub-ticket is harness-only.

## Technical Specs

- **File:** `harness/steps/game.py`
  - In `start_game`, update the Vite `Popen` (~lines 228–233) from no `env=` to `env={**os.environ, "HARNESS_GAME_PORT": str(ports.game_server)}` so `game/client/vite.config.js` proxy target matches the server started with `PORT=str(ports.game_server)`.
  - Leave server launch, port-free waits, and vite retry logic unchanged.
- **File:** `harness/tests/unit/test_game_start.py`
  - Add a test (e.g. in `TestViteCleanStart` or a new small class) that calls `start_game` with `PORTS_ALT` and asserts `factory.vite_calls[0]["kwargs"]["env"]["HARNESS_GAME_PORT"] == str(PORTS_ALT.game_server)`.
- **Context:** `game/client/vite.config.js` already reads `process.env.HARNESS_GAME_PORT || process.env.PORT || 3000` for the proxy target; no client change required.

## Verification: code
