## Update smoke-script header comments for ALLOW_DEV_AUTH

Several client smoke scripts now pass `ALLOW_DEV_AUTH: '1'` when spawning the server, but their file-header comments still list only `ALLOW_DEBUG_SCENARIOS=1` (e.g. `test-world-stage-transition.mjs`, `test-telepipe-suspend-resume.mjs`). Updating the comments avoids confusion for future maintainers.

### Acceptance Criteria
- File-header spawn-env comments in affected smoke scripts mention both `ALLOW_DEBUG_SCENARIOS=1` and `ALLOW_DEV_AUTH=1`.

## Investigate intermittent harness env propagation for capture

Round-7 and round-8 captures failed because the server subprocess did not receive `ALLOW_DEV_AUTH=1`, while `harness/steps/game.py` sets it and unit tests assert it. Fresh `capture_run()` invocations succeed. Investigate whether a long-running supervisor process caches an older `game.py` module or spawns the server through a path that omits the env var.

### Acceptance Criteria
- Root cause documented or fixed so consecutive capture rounds reliably receive `ALLOW_DEV_AUTH=1` without requiring manual process restarts.
