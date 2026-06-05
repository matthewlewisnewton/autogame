# 04-wire-allow-dev-auth-to-harness

Add `ALLOW_DEV_AUTH=1` to the harness `start_game()` environment so the server starts during harness capture runs.

## Acceptance Criteria

- `harness/steps/game.py` `start_game()` includes `ALLOW_DEV_AUTH: '1'` in the server subprocess environment.
- Harness capture runs start the game server without `initAuth()` throwing.

## Technical Specs

- **File**: `harness/steps/game.py`
- In `start_game()`, the `subprocess.Popen` for the server currently passes `env={**os.environ, "PORT": str(ports.game_server)}` — add `"ALLOW_DEV_AUTH": "1"` to that dict.

## Verification: code
