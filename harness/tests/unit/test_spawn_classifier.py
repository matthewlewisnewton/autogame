"""Unit tests for harness.agents.spawn classification helpers.

Coverage requirement from doc §11.1:
  - Retry on EMPTY_OUTPUT / API_ERROR_ONLY_OUTPUT / QUOTA_OR_RATE_LIMIT /
    TIMEOUT (one test per failure pattern)
  - FailureReason classifier against fixtures from `tests/fixtures/cli_outputs/`

We use the inline fixture strings here; tests/fixtures/cli_outputs/ is
reserved for real bash recordings that arrive in Phase 5 prep.
"""
from __future__ import annotations

import pytest

from harness.agents.base import FailureReason
from harness.agents.spawn import (
    classify,
    has_verdict,
    output_has_quota_error,
    output_is_only_error,
)


# ---------------------------------------------------------------- classify()

class TestClassify:
    def test_exit_124_timeout(self):
        assert classify(124, "anything") is FailureReason.TIMEOUT

    def test_exit_137_killed_after_timeout(self):
        assert classify(137, "anything") is FailureReason.KILLED_AFTER_TIMEOUT

    def test_exit_143_terminated_by_signal(self):
        assert classify(143, "anything") is FailureReason.TERMINATED_BY_SIGNAL

    def test_empty_stdout_is_empty_output(self):
        assert classify(0, "") is FailureReason.EMPTY_OUTPUT
        assert classify(0, "   \n  \t  \n") is FailureReason.EMPTY_OUTPUT
        assert classify(1, "") is FailureReason.EMPTY_OUTPUT
        # Timeout codes take precedence over empty output.
        assert classify(124, "") is FailureReason.TIMEOUT

    def test_quota_text_without_verdict_is_quota(self):
        text = "Working...\nYou have exhausted your capacity on this model.\n"
        assert classify(0, text) is FailureReason.QUOTA_OR_RATE_LIMIT
        text2 = "(noise)\nquota will reset after 1 hour.\n"
        assert classify(1, text2) is FailureReason.QUOTA_OR_RATE_LIMIT

    def test_quota_text_with_verdict_is_ok(self):
        """Reviewer's content mentions quota but still emits a verdict line —
        bash bugfix: don't false-classify this as quota."""
        text = (
            "Reviewed the changes.\n"
            "The implementation handles quota will reset after retries.\n"
            "\n"
            "VERDICT: PASS\n"
        )
        assert classify(0, text) is FailureReason.OK

    def test_transient_retry_line_is_not_quota(self):
        """`Attempt N failed: ... Retrying` is gemini's transient retry — not terminal."""
        text = "Attempt 1 failed: rate limit. Retrying...\nDone.\nVERDICT: PASS\n"
        assert classify(0, text) is FailureReason.OK

    def test_api_error_only_output(self):
        assert classify(1, "[API Error: 500]\n") is FailureReason.API_ERROR_ONLY_OUTPUT
        assert classify(1, "API Error: timeout\n[API Error: 502]\n") is FailureReason.API_ERROR_ONLY_OUTPUT
        assert classify(1, "Operation cancelled.\n") is FailureReason.API_ERROR_ONLY_OUTPUT
        assert classify(1, "Terminated\n") is FailureReason.API_ERROR_ONLY_OUTPUT

    def test_api_error_mixed_with_real_content_is_not_api_error_only(self):
        """If any non-blank line ISN'T a sentinel, don't classify as API_ERROR_ONLY."""
        text = "[API Error: 500]\nReal output here.\nVERDICT: PASS\n"
        assert classify(0, text) is FailureReason.OK

    def test_exit_nonzero_with_real_output_is_exit_nonzero(self):
        assert classify(1, "Some normal output here.\n") is FailureReason.EXIT_NONZERO
        assert classify(2, "Output\n") is FailureReason.EXIT_NONZERO

    def test_exit_zero_with_real_output_is_ok(self):
        assert classify(0, "Real text\n") is FailureReason.OK


# ---------------------------------------------------------------- helpers

class TestOutputIsOnlyError:
    def test_empty(self):
        assert not output_is_only_error("")
        assert not output_is_only_error("   ")

    def test_all_api_error(self):
        assert output_is_only_error("[API Error: 500]\nAPI Error: 502")

    def test_mixed(self):
        assert not output_is_only_error("[API Error: 500]\nReal content")


class TestOutputHasQuotaError:
    def test_terminal_capacity_message(self):
        assert output_has_quota_error("You have exhausted your capacity on this model.")

    def test_quota_reset_message(self):
        assert output_has_quota_error("Quota will reset after 1 hour.")

    def test_case_insensitive(self):
        assert output_has_quota_error("YOU HAVE EXHAUSTED YOUR CAPACITY ON THIS MODEL")

    def test_transient_retry_excluded(self):
        assert not output_has_quota_error(
            "Attempt 3 failed: rate limit. Retrying in 1s..."
        )

    def test_unrelated_text(self):
        assert not output_has_quota_error("All good here. VERDICT: PASS")


class TestHasVerdict:
    def test_pass_line_at_top(self):
        assert has_verdict("VERDICT: PASS\n")

    def test_pass_line_after_content(self):
        assert has_verdict("Some review...\n\nVERDICT: PASS\nMore notes")

    def test_fail_line(self):
        assert has_verdict("VERDICT: FAIL\n")

    def test_no_verdict(self):
        assert not has_verdict("No verdict line here.\nJust content.")

    def test_lowercase_not_a_verdict(self):
        """Bash regex is case-sensitive on VERDICT keyword."""
        assert not has_verdict("verdict: pass\n")

    def test_indented_not_a_verdict(self):
        """`^VERDICT` requires start-of-line — indented doesn't count."""
        assert not has_verdict("  VERDICT: PASS\n")
