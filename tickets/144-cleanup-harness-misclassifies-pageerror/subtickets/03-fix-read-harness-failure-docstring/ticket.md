# Fix stale _read_harness_failure docstring

`_read_harness_failure` in `harness/pipelines/ticket.py` still documents that
the `harness_failure` block is written "whenever `wait_for_game` timed out and
the dev servers never came up." That is no longer true: `capture_run`'s
`_classify_capture_failure()` only writes `harness_failure` when infra
signatures are detected (non-empty `detected`). Update the docstring to match.

## Acceptance Criteria
- The `_read_harness_failure` docstring states that `capture_run` writes the
  `harness_failure` block only when `_classify_capture_failure` detects an
  infra signature (non-empty `detected`), NOT on every `wait_for_game` timeout.
- The docstring (or the adjacent `should_escalate_harness_failure` docstring)
  accurately reflects that escalation is gated on `infra_failure.get("detected")`
  being truthy.
- No behavioural/code change — this is a docstring/comment-only edit. The
  functions `_read_harness_failure` and `should_escalate_harness_failure` keep
  their current logic.

## Technical Specs
- `harness/pipelines/ticket.py`: rewrite the docstring of `_read_harness_failure`
  (lines ~94-104) so it describes the current `_classify_capture_failure`
  contract (infra-signature gating) and notes that a `None` return means the
  capture either succeeded or failed for a non-infra reason. Optionally tighten
  the `should_escalate_harness_failure` docstring (lines ~107-109) for
  consistency. Do not alter any executable statements.

## Verification: code
