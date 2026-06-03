# 165-cleanup-harness-game-lifecycle-tests

## Difficulty: medium

## Goal

harness/steps/game.py (327 lines) carries fragile subprocess/port logic with separate Linux/Darwin branches (_port_holders_linux/_darwin, _pid_cmdline_linux/_darwin, start_game with vite-retry, _kill_proc_group). Tests cover only the regex helpers (test_game_port_patterns, test_game_proc_patterns, test_game_health_check); there is no test exercising the start_game/stop_game/wait_for_game lifecycle or the kill/port-free paths -- exactly the code behind the prior orphan-proc bugs (harness-fixes-2026-05-31). capture_run.py (158 lines) similarly has only test_capture_run_diagnostics.py.

## Acceptance Criteria

- Implements the Goal above; the change is scoped to it.
- Existing server + client tests pass; the game starts and loads cleanly.

## Verification

`Verification: code`
