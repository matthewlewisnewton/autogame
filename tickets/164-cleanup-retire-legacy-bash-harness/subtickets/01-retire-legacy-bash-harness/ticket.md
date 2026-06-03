# Retire the legacy bash harness

The bash agent loop (`lib.sh` + the four `run_*`/`supervisor` scripts, ~2368
lines) is fully superseded by the Python harness (`python -m harness`); nothing
imports it and the team has confirmed there will be no rollback to bash (it
stays recoverable via the `bash-rollback-v1` git tag). Delete those scripts plus
the three sibling shell scripts that only exist to `source lib.sh`, and fix the
one live Python pointer that referenced a deleted file, so the working tree no
longer carries dead, double-maintained bash.

## Acceptance Criteria

- The five core legacy bash files are deleted from the working tree:
  `harness/lib.sh`, `harness/run_ticket.sh`, `harness/run_subtask.sh`,
  `harness/run_backlog.sh`, `harness/supervisor.sh`.
- The three sibling shell scripts that `source` (and therefore depend on)
  `lib.sh` are also deleted, since they are dead once `lib.sh` is gone:
  `harness/test_port_ownership.sh`, `harness/test_review_recovery.sh`,
  `harness/qwen_vision_smoke.sh`.
- After deletion, `harness/lint.sh` is the only remaining `*.sh` file under
  `harness/`, and no surviving file contains a `source ".../lib.sh"` (or
  `bash .../run_*.sh` / `supervisor.sh`) statement that would now point at a
  deleted file. (Docstring/comment mentions like `# port of lib.sh:1202` in
  `harness/**/*.py` are NOT references and must be left untouched.)
- `harness/cli.py`'s `doctor vision` branch no longer points the user to the
  deleted `harness/qwen_vision_smoke.sh`; its message is updated to a still-true
  statement (e.g. that the vision smoke is not yet ported to Python) without
  naming a now-missing file.
- The Python harness test suite still passes: from `harness/`, `pytest -v`
  succeeds (in particular `tests/unit/test_scope_audit.py` and
  `tests/unit/test_qwen_vision_settings.py`, which only mention `lib.sh` in
  fixtures/docstrings and create their own temp copies, are unaffected).
- The game is untouched and healthy: no files under `game/` are modified, the
  existing server + client tests pass, and the game starts and loads cleanly.

## Technical Specs

- Delete these eight files (the legacy bash harness and its lib.sh-dependent
  siblings):
  - `harness/lib.sh`
  - `harness/run_ticket.sh`
  - `harness/run_subtask.sh`
  - `harness/run_backlog.sh`
  - `harness/supervisor.sh`
  - `harness/test_port_ownership.sh`
  - `harness/test_review_recovery.sh`
  - `harness/qwen_vision_smoke.sh`
- Edit `harness/cli.py` (`_cmd_doctor`, ~line 300): the `target == "vision"`
  branch currently prints `... see harness/qwen_vision_smoke.sh`. Replace the
  message so it no longer references the deleted script (state that the vision
  smoke is not yet wired/ported to Python); keep the same `return 64` and
  overall behavior.
- Do NOT touch `harness/lint.sh` or `harness/githooks/pre-commit`: `lint.sh`
  shellchecks `./*.sh` and remains valid with only itself present, and the
  pre-commit hook only runs on Added/Copied/Modified `harness/*.sh` (deletions
  do not trigger it). Leaving them avoids out-of-scope churn.
- Do NOT edit any `harness/**/*.py` other than `cli.py`: the `"port of
  lib.sh:NNN"` strings in `git_helpers.py`, `agents/*.py`, `steps/*.py`,
  `telemetry/*.py`, `prompts/*.py`, `pipelines/*.py`, and `supervisor.py` are
  provenance comments, not live references, and must stay.
- Do NOT modify any file under `game/`. The legacy bash is not imported by the
  game; this change cannot affect server/client behavior.
- The `bash-rollback-v1` git tag already preserves the deleted bash, so no
  archival copy is needed in the working tree.

## Verification: code
