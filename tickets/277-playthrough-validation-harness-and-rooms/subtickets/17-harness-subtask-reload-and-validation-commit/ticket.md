# Harness subtask reload and validation commit path

Round-7 remediation for failed sub-ticket 16. Sub-tickets **10** and **15** landed `allow_validation` and regression tests, but sub-ticket 16 still hit `scope_audit` reverting every `validation/rooms/` file five times in the same `ticket()` process. The live log never shows `[scope] validation writes allowed`, while `pytest harness/tests/integration/test_subtask_pipeline.py::TestSubtaskValidationScope` passes in a fresh interpreter — committed harness fixes are not visible to later sub-tickets in one long-running ticket. Reload harness modules before each sub-ticket and finish the validation commit path so execute sub-tickets can land artifacts.

## Acceptance Criteria

- `harness/pipelines/ticket.py` reloads the harness modules that govern sub-ticket scope and commit (`harness.pipelines.subtask`, `harness.steps.implement`, `harness.git_helpers`, `harness.steps.commit` at minimum) immediately before each non-`.passed` sub-ticket invocation, so a harness fix committed in sub-ticket *N* is active when sub-ticket *N+1* starts in the same ticket run.
- `harness/tests/integration/test_subtask_pipeline.py` adds a regression proving the reload: stub `implement.allow_validation` (or `_detect_ticket_allows_validation`) as `False` at import time, commit a workspace change that sets it `True`, call the ticket-level subtask runner helper, and assert validation writes survive `scope_audit` without restarting the interpreter manually.
- `harness/git_helpers.py::commit_verified` accepts `include_validation: bool = False`; when true, staged paths are `["."]` (same as `include_harness=True`), when false but harness excluded, stage `[".", ":!harness"]` and do **not** exclude `validation/`.
- `harness/pipelines/subtask.py` passes `include_validation=ticket_allows_validation` into `commit_with_role`; `harness/steps/commit.py` forwards it to `commit_verified`.
- `cd game && pnpm test:quick` still passes.
- Do **not** run `pnpm validate:rooms` or write under `validation/rooms/` in this sub-ticket.

## Technical Specs

- `harness/pipelines/ticket.py`: add `_reload_harness_for_subtask()` using `importlib.reload` on the modules above; call it in the sub-ticket loop before `subtask(...)`.
- `harness/git_helpers.py`: extend `commit_verified(..., include_validation=False)`; path selection: `["."]` if `include_harness or include_validation`, else `[".", ":!harness"]`.
- `harness/steps/commit.py`: add `include_validation` parameter; pass through to `commit_verified`.
- `harness/pipelines/subtask.py`: `commit_with_role(..., include_validation=ticket_allows_validation)`.
- `harness/tests/integration/test_subtask_pipeline.py`: add `TestSubtaskHarnessReload` (or extend `TestSubtaskValidationScope`) with the import-time stub + post-commit reload assertion described above.
- `harness/tests/unit/test_commit_verified.py` (create if missing): assert `include_validation=True` stages `validation/rooms/findings.md` while default still excludes only `harness/`.
- Depends on passed sub-tickets **01–11**, **13**, **15**, and **10**. No `game/` changes.

## Verification: code
