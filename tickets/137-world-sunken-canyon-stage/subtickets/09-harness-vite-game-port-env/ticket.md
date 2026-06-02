# Harness passes game port into Vite subprocess env

`start_game` already sets `PORT` on the game-server child; the Vite child must receive the same `ports.game_server` via `PORT` and `HARNESS_GAME_PORT` so `vite.config.js` proxies correctly even when the parent shell has no port env vars.

## Acceptance Criteria

- In `harness/steps/game.py` `start_game`, the Vite `subprocess.Popen` passes `env={**os.environ, "PORT": str(ports.game_server), "HARNESS_GAME_PORT": str(ports.game_server)}` (same numeric port as the server child).
- The game-server `Popen` behavior is unchanged (still sets `PORT` only).
- `harness/tests/unit/test_start_game_vite_env.py` (new) mocks `subprocess.Popen` and asserts the Vite launch call includes both env vars equal to the allocated `ports.game_server`, while a call with `HARNESS_GAME_PORT` / `PORT` cleared from `os.environ` still wires the explicit `PortAllocation` port.
- `python -m pytest harness/tests/unit/test_start_game_vite_env.py -q` passes.

## Technical Specs

- **`harness/steps/game.py`**: build `game_env = {**os.environ, "PORT": str(ports.game_server), "HARNESS_GAME_PORT": str(ports.game_server)}` once; use it for the Vite `Popen` `env=` argument (lines ~228–233). Keep server launch as today.
- **`harness/tests/unit/test_start_game_vite_env.py`**: patch `subprocess.Popen`, invoke `start_game` with `PortAllocation(game_server=3004, vite=5175)` under a monkeypatched empty/minimal `os.environ` for port keys; capture kwargs for the `npx vite` invocation and assert env values. Mirror patterns from `harness/tests/unit/test_capture_run_diagnostics.py` for patching.
- **Prerequisite**: sub-ticket `08-client-vite-proxy-game-port` (or equivalent) must have landed dynamic proxy targets in `vite.config.js`; this ticket only wires the harness env contract.
- **Out of scope**: changes under `game/client/` except if a one-line comment is needed (prefer none).

## Verification: code
