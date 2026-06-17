# Harness: allow CONTEXT.md edits for doc-only sub-tickets

Sub-ticket 02 failed with SCOPE-CONFLICT because the implementer's `game/**` scope blocks repo-root `CONTEXT.md` edits. Add harness support so sub-tickets that target `CONTEXT.md` can land the one-line auth wording fix in sub-ticket 06 without `scope_audit` reverting it.

## Acceptance Criteria

- `harness/pipelines/subtask.py` detects when a sub-ticket `ticket.md` names `CONTEXT.md` as a file to change and passes `"CONTEXT.md"` in `extra_safe_paths` to `implement()` (same mechanism as `handoff.md` and `round-*` artifact paths).
- Detection is narrow: only fires when the ticket body references `CONTEXT.md` (not every sub-ticket).
- Existing sub-ticket behavior is unchanged when `CONTEXT.md` is not mentioned.
- A unit test in `harness/tests/` covers the new detection helper (ticket with `CONTEXT.md` → true; ticket without → false).

## Technical Specs

- **`harness/pipelines/subtask.py`**
  - Add `_CONTEXT_REF_RE` (or equivalent) and `_detect_ticket_allows_context(ticket_file)`.
  - When true, append `"CONTEXT.md"` to `extra_safe_paths` in the `implement()` call inside `_subtask_body`.
- **`harness/tests/unit/test_subtask_context_scope.py`** (new) — test the detection helper in isolation.
- Do **not** edit `CONTEXT.md` or game code in this sub-ticket.

## Verification: code
