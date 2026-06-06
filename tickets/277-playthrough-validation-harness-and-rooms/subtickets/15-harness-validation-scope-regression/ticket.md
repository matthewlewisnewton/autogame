# Harness validation scope regression and QA diff wiring

Round-6 remediation for failed sub-ticket 14. Sub-ticket 10 threaded `allow_validation` into implementer `scope_audit`, but sub-ticket 14 exhausted MAX_ITER with every iteration reverted as out-of-scope under `validation/rooms/` despite a successful `pnpm validate:rooms` run. Codify the validation safe-path with an integration test (mirroring `TestSubtaskHarnessScope`) and widen the subtask diff capture so validation-targeting sub-tickets expose non-`game/` changes to code QA.

## Acceptance Criteria

- `harness/tests/integration/test_subtask_pipeline.py` adds `TestSubtaskValidationScope` with two cases:
  - When `ticket.md` references `validation/`, an implementer stub that creates `validation/rooms/findings.md` survives `scope_audit` and the sub-ticket passes on the first iteration (no scope-violation retries).
  - When `ticket.md` does **not** reference `validation/`, the same stub write is reverted and the sub-ticket fails soft after `max_iter` (scope violation, not escalate).
- `_subtask_body` logs whether validation scope is enabled, e.g. `[scope] validation writes allowed` when `_detect_ticket_allows_validation` is true (helps diagnose future scope_audit failures).
- When `ticket_allows_validation` is true, the iteration `changes.diff` is captured with `git diff HEAD -- . ':!tickets'` (same as the harness-allow branch) instead of `game/` only, so code QA can see validation artifact paths alongside any incidental edits.
- `cd game && pnpm test:quick` still passes.
- Do **not** run `pnpm validate:rooms` or write under `validation/rooms/` in this sub-ticket.

## Technical Specs

- `harness/tests/integration/test_subtask_pipeline.py`: add `TestSubtaskValidationScope` class following the `TestSubtaskHarnessScope` stub-agent pattern (`StubAgent` writes into `validation/rooms/` during implementer `run()`).
- `harness/pipelines/subtask.py`: log validation-scope flag in `_subtask_body`; branch diff capture on `ticket_allows_validation` (reuse the `:!tickets` whole-tree diff when validation or harness is allowed).
- Depends on passed sub-tickets **01–11**, **13**, and **10** (validation safe-path). No `game/` changes.

## Verification: code
