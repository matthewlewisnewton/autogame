# Classify confirm_game_broken server-down metrics

`confirm_game_broken()` writes a bare `{"ok": false, "error": "servers did not
start"}` when the confirmation run's dev servers never come up, bypassing
`_classify_capture_failure()`. Route that path through the classifier so
empty-`detected` confirmation runs do not leave ambiguous metrics for the smoke
gate.

## Acceptance Criteria
- When `wait_for_game(...)` returns false in `confirm_game_broken`, the
  confirmation `metrics.json` is produced by `_classify_capture_failure(dir,
  ports)` instead of the hard-coded `{"ok": false, "error": "servers did not
  start"}` literal.
- A confirmation run whose logs contain an infra signature still yields a
  `harness_failure` block (preserving current behaviour for the EADDRINUSE case).
- A confirmation run with NO infra signature and NO page errors yields the
  classifier's `capture_failed` fallback (not a bare/ambiguous `error` string).
- `confirm_game_broken` still returns `True` on the server-down path.
- `game_smoke_ok` continues to treat the classified server-down metrics as
  broken (returns `False`), so the smoke gate behaviour is unchanged.

## Technical Specs
- `harness/steps/confirm_broken.py`: in `confirm_game_broken`, replace the
  `metrics.json` write inside the `if not wait_for_game(...)` block (lines
  55-58) with a call to `_classify_capture_failure(confirmation_dir, ports)`
  and write its returned dict (json.dumps + newline). Import
  `_classify_capture_failure` from `harness.steps.capture_run` (match the
  existing local-import style already used for `start_game`/`stop_game`/
  `wait_for_game`/`capture`).
- Confirm `game_smoke_ok` (same file) still returns `False` for both the
  `harness_failure` (`error == "servers did not start"`) and `capture_failed`
  outputs — its existing `ok is False` / `servers did not start` checks should
  already cover this; do not weaken them.

## Verification: code
